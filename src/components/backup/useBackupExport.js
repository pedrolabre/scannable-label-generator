import { useCallback, useRef, useState } from 'react';

import {
  buildBackupFile,
  buildBackupFileName,
  serializeBackupFile,
} from '../../domain/services/backupFile.js';
import { downloadBlob } from '../../lib/download.js';
import { readBackupTables } from '../../storage/backupRepository.js';

/**
 * Estado da exportacao e a sequencia que a executa.
 *
 * A sequencia e curta e sempre a mesma: ler as quatro tabelas, montar o
 * envelope, escrever o texto e disparar o download. Fica fora do JSX pelo mesmo
 * motivo que a exportacao do PDF ficou: o componente desenha, e quem conduz a
 * sequencia e uma funcao que pode ser lida de cima a baixo.
 *
 * Duas exportacoes ao mesmo tempo sao impedidas aqui, e nao so pelo botao
 * desabilitado: o estado da tela pode mudar entre o clique e o proximo desenho.
 *
 * O mesmo instante serve para o envelope e para o nome do arquivo. Duas leituras
 * de relogio poderiam cair em dias diferentes, e o arquivo diria uma data no
 * nome e outra por dentro.
 */

const FAILURE_MESSAGE = 'Não foi possível gerar o arquivo de backup. Tente de novo.';

export const BACKUP_EXPORT_STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  FAILED: 'failed',
});

export function useBackupExport() {
  const [status, setStatus] = useState(BACKUP_EXPORT_STATUS.IDLE);
  const [error, setError] = useState(null);
  const runningRef = useRef(false);

  const exportBackup = useCallback(async () => {
    if (runningRef.current) {
      return;
    }

    runningRef.current = true;
    setStatus(BACKUP_EXPORT_STATUS.RUNNING);
    setError(null);

    try {
      const generatedAt = new Date();
      const tables = await readBackupTables();
      const text = serializeBackupFile(buildBackupFile(tables, generatedAt));

      downloadBlob(
        new Blob([text], { type: 'application/json' }),
        buildBackupFileName(generatedAt),
      );

      setStatus(BACKUP_EXPORT_STATUS.IDLE);
    } catch {
      setStatus(BACKUP_EXPORT_STATUS.FAILED);
      setError(FAILURE_MESSAGE);
    } finally {
      runningRef.current = false;
    }
  }, []);

  return { status, error, exportBackup };
}
