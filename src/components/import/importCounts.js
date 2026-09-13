/**
 * Contagens do lote em texto. Um lote pode ter centenas de milhares de
 * registros, e o separador de milhar e o que torna esse numero legivel de
 * relance — "199.985" e uma informacao, "199985" e um enigma.
 */
export function formatCount(count) {
  return count.toLocaleString('pt-BR');
}

export function pluralize(count, singular, plural) {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}
