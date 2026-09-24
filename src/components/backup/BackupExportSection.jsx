import { Download, Loader2 } from 'lucide-react';

import { describeLargeBackupWarning } from '../../domain/services/backupText.js';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

import { BACKUP_EXPORT_STATUS, useBackupExport } from './useBackupExport.js';

/**
 * Metade de cima do cartao: gerar o arquivo.
 *
 * Nao ha teto de tamanho, e sim aviso. Um catalogo grande continua exportavel —
 * recusar seria deixar justamente quem mais precisa do arquivo sem forma de
 * tirar os dados do dispositivo. O que o aviso faz e explicar, antes do clique,
 * por que a pagina vai ficar parada por um instante.
 */
export default function BackupExportSection({ productCount }) {
  const { status, error, exportBackup } = useBackupExport();

  const isRunning = status === BACKUP_EXPORT_STATUS.RUNNING;
  const sizeWarning = describeLargeBackupWarning(productCount);

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">Exportar</h3>

      <p className="text-sm leading-relaxed text-neutro-tintaMedia">
        Gera um arquivo com todo o conteúdo gravado neste dispositivo. Guarde-o fora do aparelho ou
        leve-o para outro, onde ele reconstrói o mesmo ambiente.
      </p>

      {sizeWarning ? <p className="text-sm text-neutro-tintaMedia">{sizeWarning}</p> : null}

      <Button type="button" variant="primary" onClick={exportBackup} disabled={isRunning}>
        {isRunning ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        {isRunning ? 'Gerando o arquivo…' : 'Exportar backup'}
      </Button>

      {error ? <InlineAlert>{error}</InlineAlert> : null}
    </div>
  );
}
