import { pluralize } from './importCounts.js';

/**
 * Uma frase com o resultado da conferencia do lote.
 *
 * Ela e a primeira coisa a ser lida porque e a unica que cabe em um lote de
 * qualquer tamanho: com 200 mil registros e tres recusados, o numero e a
 * resposta, e as tres linhas abaixo dela sao o detalhe.
 */
function reviewSentence({ readyCount, attentionCount, refusedCount }) {
  const total = readyCount + attentionCount + refusedCount;
  const head = pluralize(total, 'registro conferido', 'registros conferidos');

  if (attentionCount === 0 && refusedCount === 0) {
    return `${head}: todos prontos.`;
  }

  const parts = [];

  if (readyCount > 0) {
    parts.push(pluralize(readyCount, 'pronto', 'prontos'));
  }

  if (attentionCount > 0) {
    parts.push(`${pluralize(attentionCount, 'registro', 'registros')} para conferir`);
  }

  if (refusedCount > 0) {
    parts.push(pluralize(refusedCount, 'recusado', 'recusados'));
  }

  return `${head}: ${parts.join(', ')}.`;
}

export default function ImportReviewSummary({ report }) {
  return (
    <div className="space-y-1">
      <p role="status" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {reviewSentence(report)}
      </p>

      {report.refusedCount > 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Os registros recusados não seguem para o catálogo. Corrija o arquivo de origem e leia o
          arquivo de novo.
        </p>
      ) : null}
    </div>
  );
}
