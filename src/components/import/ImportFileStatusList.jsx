import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { IMPORT_FILE_REJECTED } from '../../domain/services/importService.js';

/**
 * Resultado arquivo a arquivo do lote. O arquivo recusado aparece na mesma
 * lista dos aceitos, com o motivo ao lado do nome: e assim que fica visivel
 * que a recusa de um nao interrompeu a leitura dos outros.
 */

function recordCountLabel(count) {
  return count === 1 ? '1 registro lido' : `${count} registros lidos`;
}

function ImportFileStatusItem({ file }) {
  const isRejected = file.status === IMPORT_FILE_REJECTED;
  const Icon = isRejected ? AlertTriangle : CheckCircle2;

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon
        className={
          isRejected
            ? 'mt-0.5 h-4 w-4 shrink-0 text-marca-vermelhoTexto'
            : 'mt-0.5 h-4 w-4 shrink-0 text-marca-verdeTexto'
        }
        aria-hidden="true"
      />

      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-semibold text-neutro-tintaMedia">{file.fileName}</p>

        {isRejected ? (
          <p className="text-sm text-marca-vermelhoTexto">{file.error}</p>
        ) : (
          <p className="text-sm text-neutro-tintaFraca">{recordCountLabel(file.recordCount)}</p>
        )}
      </div>
    </li>
  );
}

export default function ImportFileStatusList({ files }) {
  if (files.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label="Resultado por arquivo"
      className="divide-y divide-neutro-divisor rounded border border-neutro-divisor"
    >
      {files.map((file) => (
        <ImportFileStatusItem key={file.fileIndex} file={file} />
      ))}
    </ul>
  );
}
