import { useCallback, useRef, useState } from 'react';

import { readBackupFile } from '../../domain/services/backupRead.js';
import { restoreBackup } from '../../domain/services/backupWriter.js';
import { writeBackupTables } from '../../storage/backupRepository.js';
import { describeStorageError } from '../../storage/storageError.js';

/**
 * Estado da restauracao e a sequencia que a executa.
 *
 * A sequencia tem uma pausa obrigatoria no meio, e e ela que da forma a este
 * estado: escolher o arquivo, conferir o arquivo inteiro, **esperar a
 * confirmacao do operador**, e so entao gravar. Entre a conferencia e a
 * confirmacao nada foi tocado no armazenamento, e cancelar ali nao desfaz coisa
 * alguma porque nada foi feito.
 *
 * A recusa nao e um erro de execucao: e um resultado legitimo da conferencia, e
 * por isso tem estado proprio e relatorio proprio, em vez de virar uma frase de
 * falha. O que vira falha e a leitura do arquivo do disco e a gravacao.
 *
 * `onRestored` e chamado depois de a gravacao fechar. E por ele que a tela
 * relida sai do estado velho — a listagem, a selecao de impressao e a previa
 * apontam para identificadores que podem nao existir mais.
 */

const READ_FAILURE_MESSAGE = 'Não foi possível ler o arquivo escolhido. Tente de novo.';

export const BACKUP_RESTORE_STATUS = Object.freeze({
  IDLE: 'idle',
  READING: 'reading',
  REFUSED: 'refused',
  CONFIRMING: 'confirming',
  WRITING: 'writing',
  DONE: 'done',
});

export function useBackupRestore({ onRestored } = {}) {
  const [status, setStatus] = useState(BACKUP_RESTORE_STATUS.IDLE);
  const [report, setReport] = useState(null);
  const [pending, setPending] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const runningRef = useRef(false);

  const reset = useCallback(() => {
    setStatus(BACKUP_RESTORE_STATUS.IDLE);
    setReport(null);
    setPending(null);
    setResult(null);
    setError(null);
  }, []);

  const chooseFile = useCallback(async (chosen) => {
    if (runningRef.current) {
      return;
    }

    runningRef.current = true;
    setStatus(BACKUP_RESTORE_STATUS.READING);
    setReport(null);
    setPending(null);
    setResult(null);
    setError(null);

    try {
      const text = await chosen.text();
      const read = readBackupFile(text);

      if (!read.file) {
        setReport({
          issues: read.issues,
          totalIssues: read.totalIssues,
          omittedIssues: read.omittedIssues,
        });
        setStatus(BACKUP_RESTORE_STATUS.REFUSED);
        return;
      }

      setPending({ file: read.file, fileName: chosen.name });
      setStatus(BACKUP_RESTORE_STATUS.CONFIRMING);
    } catch {
      setReport({
        issues: [{ where: null, message: READ_FAILURE_MESSAGE }],
        totalIssues: 1,
        omittedIssues: 0,
      });
      setStatus(BACKUP_RESTORE_STATUS.REFUSED);
    } finally {
      runningRef.current = false;
    }
  }, []);

  const cancelRestore = useCallback(() => {
    setPending(null);
    setError(null);
    setStatus(BACKUP_RESTORE_STATUS.IDLE);
  }, []);

  // O erro da gravacao mantem o dialogo aberto: o botao de confirmar volta a
  // ficar ativo e serve de nova tentativa, que e como o dialogo de confirmacao
  // ja se comporta no resto da aplicacao.
  const confirmRestore = useCallback(async () => {
    if (runningRef.current || !pending) {
      return;
    }

    runningRef.current = true;
    setStatus(BACKUP_RESTORE_STATUS.WRITING);
    setError(null);

    try {
      const written = await restoreBackup(pending.file, {
        repository: { replaceAllProducts: (products) => writeBackupTables({ products }) },
      });

      await onRestored?.();

      setResult(written);
      setPending(null);
      setStatus(BACKUP_RESTORE_STATUS.DONE);
    } catch (failure) {
      setError(describeStorageError(failure));
      setStatus(BACKUP_RESTORE_STATUS.CONFIRMING);
    } finally {
      runningRef.current = false;
    }
  }, [onRestored, pending]);

  return { status, report, pending, result, error, chooseFile, confirmRestore, cancelRestore, reset };
}
