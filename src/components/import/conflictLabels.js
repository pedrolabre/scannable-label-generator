import {
  CONFLICT_KIND_BATCH,
  CONFLICT_KIND_CATALOG,
  CONFLICT_KIND_IDENTICAL,
  DECISION_KEEP_BOTH,
  DECISION_REPLACE,
  DECISION_SKIP,
} from '../../domain/services/importConflict.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';

import { formatCount } from './importCounts.js';

/**
 * Os textos do conflito, em um lugar so.
 *
 * A linha do registro e a acao em massa dizem as mesmas coisas sobre os mesmos
 * verbos, e o rotulo do botao precisa ser identico nos dois — e ele que o usuario
 * usa para entender o que a acao em massa vai fazer com cada linha.
 */

export const DECISION_LABEL = {
  [DECISION_REPLACE]: 'Substituir o gravado',
  [DECISION_SKIP]: 'Pular este registro',
  [DECISION_KEEP_BOTH]: 'Gravar como novo',
};

export const DECISION_RESULT = {
  [DECISION_REPLACE]: 'O produto que está no catálogo será substituído por este.',
  [DECISION_SKIP]: 'Este registro não será gravado.',
  [DECISION_KEEP_BOTH]: 'Será gravado como um produto separado, com o mesmo código.',
};

function batchSentence(count) {
  return `Este código aparece em ${formatCount(count)} registros deste lote.`;
}

export function describeCodeConflict(code) {
  if (code.kind === CONFLICT_KIND_IDENTICAL) {
    return 'Este produto já está no catálogo, igual ao que o arquivo trouxe. Ele não será gravado de novo.';
  }

  if (code.kind === CONFLICT_KIND_CATALOG) {
    const head = 'Este código já existe no catálogo.';

    return code.batchCount > 1 ? `${head} ${batchSentence(code.batchCount)}` : head;
  }

  return code.kind === CONFLICT_KIND_BATCH ? batchSentence(code.batchCount) : '';
}

/** O produto gravado, do jeito que permite compará-lo com o que veio do arquivo. */
export function describeStoredProduct(product) {
  const price =
    typeof product.priceInCentavos === 'number' ? formatCentavosAsBRL(product.priceInCentavos) : null;

  return price ? `${product.displayName} — ${price}` : product.displayName;
}

export function describeNameConflict(name) {
  if (name.inBatch && name.inCatalog) {
    return 'Este nome se repete no lote e já existe no catálogo.';
  }

  if (name.inBatch) {
    return `Este nome aparece em ${formatCount(name.batchCount)} registros deste lote.`;
  }

  return 'Já existe um produto no catálogo com este nome.';
}
