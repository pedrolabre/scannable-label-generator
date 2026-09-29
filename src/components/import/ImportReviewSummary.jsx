import { enrichmentSentence } from './enrichmentSentence.js';
import { pluralize } from './importCounts.js';

/**
 * Uma frase com o resultado da conferencia do lote.
 *
 * Ela e a primeira coisa a ser lida porque e a unica que cabe em um lote de
 * qualquer tamanho: com 200 mil registros e tres recusados, o numero e a
 * resposta, e as tres linhas abaixo dela sao o detalhe.
 *
 * Logo abaixo vem o que a base de referencia completou, contado sobre o lote
 * inteiro: quase todo registro completado chega pronto e nao aparece na lista,
 * entao e so aqui que o numero dele pode ser lido. Quando a leitura da base
 * falha, o aviso diz que o lote seguiu como veio do arquivo e que a gravacao
 * continua disponivel — a base nunca impede a importacao.
 */
function reviewSentence({ readyCount, attentionCount, pendingCount, refusedCount }) {
  const total = readyCount + attentionCount + pendingCount + refusedCount;
  const head = pluralize(total, 'registro conferido', 'registros conferidos');

  if (attentionCount === 0 && pendingCount === 0 && refusedCount === 0) {
    return `${head}: todos prontos.`;
  }

  const parts = [];

  if (readyCount > 0) {
    parts.push(pluralize(readyCount, 'pronto', 'prontos'));
  }

  if (attentionCount > 0) {
    parts.push(`${pluralize(attentionCount, 'registro', 'registros')} para conferir`);
  }

  if (pendingCount > 0) {
    parts.push(`${pluralize(pendingCount, 'esperando', 'esperando')} decisão`);
  }

  if (refusedCount > 0) {
    parts.push(pluralize(refusedCount, 'recusado', 'recusados'));
  }

  return `${head}: ${parts.join(', ')}.`;
}

const REFERENCE_FAILURE_TEXT =
  'A base de referência não foi consultada: o NCM e o código de barras ficam como vieram do arquivo, e a gravação continua disponível.';

export default function ImportReviewSummary({ report, enrichment = null, referenceError = null }) {
  const enrichmentText = enrichmentSentence(enrichment);

  return (
    <div className="space-y-1">
      <p role="status" className="text-sm font-semibold text-neutro-tintaMedia">
        {reviewSentence(report)}
      </p>

      {enrichmentText ? (
        <p className="text-sm text-neutro-tintaMedia" data-resumo-enriquecimento="">
          {enrichmentText}
        </p>
      ) : null}

      {referenceError ? (
        <p
          className="border border-marca-amareloBorda bg-marca-amareloTenue p-3 text-sm text-marca-amareloTexto"
          data-falha-base=""
        >
          {`${referenceError} ${REFERENCE_FAILURE_TEXT}`}
        </p>
      ) : null}

      {report.refusedCount > 0 ? (
        <p className="text-sm text-neutro-tintaFraca">
          Os registros recusados não seguem para o catálogo. Corrija o arquivo de origem e leia o
          arquivo de novo.
        </p>
      ) : null}
    </div>
  );
}
