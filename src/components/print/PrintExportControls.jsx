import { describeExportLimit } from '../../domain/services/printExport.js';

import InlineAlert from '../ui/InlineAlert.jsx';

import PrintExportButton from './PrintExportButton.jsx';
import { EXPORT_STATUS, usePrintExport } from './usePrintExport.js';

/**
 * Linha de estado do trabalho com a acao de exportar ao lado.
 *
 * Fica junto porque e a mesma informacao: o texto diz o que sera exportado, o
 * botao exporta, e enquanto a geracao corre o texto passa a dizer em que folha
 * ela esta. Sem biblioteca de notificacao e sem toast — a resposta aparece onde
 * o clique aconteceu.
 *
 * O teto de exportacao aparece aqui e so aqui: ele nao bloqueia o trabalho nem
 * esconde a previa, porque a selecao continua valida; o que ele impede e gerar
 * um arquivo que ninguem conseguiria abrir.
 */

export default function PrintExportControls({
  job,
  sheet,
  labelLayout,
  grid,
  products,
  readyMessage,
  canExport,
}) {
  const { status, message, exportJob } = usePrintExport();

  const running = status === EXPORT_STATUS.RUNNING;
  const limitMessage = describeExportLimit(job.items);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          data-print-status={running ? 'exporting' : 'ready'}
          className="text-sm text-slate-600 dark:text-slate-300"
        >
          {running && message ? message : readyMessage}
        </p>

        <PrintExportButton
          running={running}
          disabled={!canExport || Boolean(limitMessage)}
          onExport={() => exportJob({ job, sheet, labelLayout, grid, products })}
        />
      </div>

      {limitMessage ? (
        <p data-export-limit="" className="text-xs text-[#8a5a00] dark:text-[#f4c95f]">
          {limitMessage}
        </p>
      ) : null}

      {status === EXPORT_STATUS.FAILED && message ? (
        <div data-export-status="failed">
          <InlineAlert>{message}</InlineAlert>
        </div>
      ) : null}
    </div>
  );
}
