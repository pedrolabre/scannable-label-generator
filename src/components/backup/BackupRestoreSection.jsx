import { CheckCircle2 } from 'lucide-react';

import {
  describeBackupOrigin,
  describeRestoreImpact,
  describeRestoreResult,
  describeRestoreWarning,
} from '../../domain/services/backupText.js';
import { countBackupProducts } from '../../domain/services/backupFile.js';
import ConfirmModal from '../ui/ConfirmModal.jsx';

import BackupFilePicker from './BackupFilePicker.jsx';
import BackupRefusalReport from './BackupRefusalReport.jsx';
import { BACKUP_RESTORE_STATUS, useBackupRestore } from './useBackupRestore.js';

/**
 * Metade de baixo do cartao: ler um arquivo e reconstruir o ambiente com ele.
 *
 * Escolher o arquivo ja e a intencao de restaurar, entao a confirmacao aparece
 * assim que a conferencia passa — e nao depois de um segundo botao que so
 * repetiria a mesma pergunta. O que o operador le antes de confirmar e a data de
 * geracao do arquivo, quantos produtos ele traz, quantos ha aqui agora e o que
 * acontece com eles.
 *
 * Entre a conferencia e a confirmacao nada foi gravado, entao cancelar nao
 * desfaz coisa alguma: apenas fecha o dialogo.
 */
export default function BackupRestoreSection({ currentProductCount, onRestored }) {
  const { status, report, pending, result, error, chooseFile, confirmRestore, cancelRestore } =
    useBackupRestore({ onRestored });

  const isBusy =
    status === BACKUP_RESTORE_STATUS.READING || status === BACKUP_RESTORE_STATUS.WRITING;

  return (
    <div className="space-y-3 border-t border-neutro-divisor pt-6">
      <h3 className="text-base font-semibold">Restaurar</h3>

      <p className="text-sm leading-relaxed text-neutro-tintaFraca">
        Lê um arquivo de backup e recria o ambiente que ele guarda. O arquivo é conferido inteiro
        antes de qualquer gravação: se algo nele estiver errado, ele é recusado e nada muda aqui.
      </p>

      <BackupFilePicker isBusy={isBusy} onFileSelected={chooseFile} />

      {status === BACKUP_RESTORE_STATUS.REFUSED && report ? (
        <BackupRefusalReport report={report} />
      ) : null}

      {status === BACKUP_RESTORE_STATUS.DONE && result ? (
        <p role="status" className="flex items-center gap-2 text-sm text-marca-verdeTexto">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {describeRestoreResult(result.restoredProducts)}
        </p>
      ) : null}

      {pending ? (
        <ConfirmModal
          title="Restaurar este backup?"
          subtitle={pending.fileName}
          confirmLabel="Restaurar e substituir"
          isConfirming={status === BACKUP_RESTORE_STATUS.WRITING}
          error={error}
          onConfirm={confirmRestore}
          onCancel={cancelRestore}
        >
          <p>{describeBackupOrigin(pending.file.generatedAt)}</p>
          <p>{describeRestoreImpact(countBackupProducts(pending.file), currentProductCount)}</p>
          <p>{describeRestoreWarning(currentProductCount)}</p>
        </ConfirmModal>
      ) : null}
    </div>
  );
}
