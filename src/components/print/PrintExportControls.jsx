import { describeExportLimit } from '../../domain/services/printExport.js';

import InlineAlert from '../ui/InlineAlert.jsx';

import PrintExportButton from './PrintExportButton.jsx';
import { EXPORT_STATUS } from './usePrintExport.js';

/**
 * Pe de acoes do trabalho de impressao: o que impede ou acompanha a exportacao,
 * a acao que vem antes dela e o botao de exportar.
 *
 * Ele aparece em dois lugares, no rodape da coluna da esquerda e na ficha do
 * dialogo da folha, e os dois recebem o mesmo `exporter`, criado uma vez por
 * quem monta a tela. Nao existe segundo caminho de exportacao: o clique num
 * lugar e o progresso lido no outro sao o mesmo estado, e duas exportacoes ao
 * mesmo tempo continuam impedidas por quem executa.
 *
 * `request` e o trabalho pronto para sair, ou nulo quando a configuracao ainda
 * nao vale. O botao continua a vista nos dois casos, desabilitado no segundo:
 * sumir com ele mudaria o rodape de altura a cada campo em edicao.
 *
 * O teto de exportacao aparece aqui, acima dos botoes, e so aqui: ele nao
 * bloqueia o trabalho nem esconde a previa, porque a selecao continua valida; o
 * que ele impede e gerar um arquivo que ninguem conseguiria abrir.
 *
 * `leadingAction` e o botao que fica acima do de exportar — a previa da folha
 * na coluna, o fechar no dialogo.
 */
export default function PrintExportControls({ exporter, request = null, leadingAction = null }) {
  const { status, message, exportJob } = exporter;

  const running = status === EXPORT_STATUS.RUNNING;
  const limitMessage = request ? describeExportLimit(request.job.items) : null;

  return (
    <div className="flex flex-col gap-2" data-export-controls="">
      {limitMessage ? (
        <p
          data-export-limit=""
          className="border border-marca-amareloBorda bg-marca-amareloTenue p-3 text-xs leading-snug text-marca-amareloTexto"
        >
          {limitMessage}
        </p>
      ) : null}

      {running && message ? (
        <p
          data-export-progress=""
          aria-live="polite"
          className="text-xs tabular-nums text-neutro-tintaFraca"
        >
          {message}
        </p>
      ) : null}

      {status === EXPORT_STATUS.FAILED && message ? (
        <div data-export-status="failed">
          <InlineAlert>{message}</InlineAlert>
        </div>
      ) : null}

      {leadingAction}

      <PrintExportButton
        className="w-full"
        running={running}
        disabled={!request || Boolean(limitMessage)}
        onExport={() => exportJob(request)}
      />
    </div>
  );
}
