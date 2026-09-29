import { formatCount, pluralize } from './importCounts.js';

/**
 * A frase da revisao sobre a base de referencia: quantos registros ganharam
 * NCM e quantos ganharam codigo de barras pela base, e quantos tinham codigo
 * fora dela.
 *
 * Sem nada completado nao ha frase, e a revisao fica como era antes de a base
 * existir — inclusive com a base vazia, quando todo codigo esta fora dela e
 * dizer isso a cada lote seria ruido. O campo que ninguem ganhou fica fora da
 * frase pelo mesmo motivo.
 *
 * A contagem e por registro, e nao por codigo distinto, como o resto da
 * revisao: um codigo que aparece duas vezes no lote completa dois registros.
 */
export function enrichmentSentence(summary) {
  if (!summary || summary.enriched === 0) {
    return null;
  }

  const fields = [];

  if (summary.gainedByField.ncm > 0) {
    fields.push(`${formatCount(summary.gainedByField.ncm)} com NCM`);
  }

  if (summary.gainedByField.ean > 0) {
    fields.push(`${formatCount(summary.gainedByField.ean)} com código de barras`);
  }

  const head = `Completados pela base de referência: ${fields.join(' e ')}.`;

  if (summary.notFound === 0) {
    return head;
  }

  const outside = pluralize(
    summary.notFound,
    'registro com código fora da base',
    'registros com código fora da base',
  );

  return `${head} ${outside}.`;
}
