import { applyDivergenceChoices } from '../domain/services/catalogCompletion.js';
import { listProducts, updateProducts } from '../storage/productRepository.js';

import { useProductStore } from './useProductStore.js';

/** Estado da gravacao das divergencias, o mesmo nos dois dialogos. */
export const DIVERGENCE_STATUS = Object.freeze({
  IDLE: 'idle',
  APPLYING: 'applying',
});

/**
 * Grava as divergencias escolhidas sobre o catalogo relido na hora, numa
 * transacao so, e rele a listagem.
 */
export async function writeDivergenceChoices(divergences, chosenIds) {
  const plan = applyDivergenceChoices(await listProducts(), divergences, chosenIds);

  await updateProducts(plan.products);

  if (plan.products.length > 0) {
    await useProductStore
      .getState()
      .loadProducts()
      .catch(() => {});
  }

  return plan.summary;
}
