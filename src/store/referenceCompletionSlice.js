import {
  planReferenceCompletion,
  referenceCodesToAsk,
} from '../domain/services/referenceCompletion.js';
import { listProducts, updateProducts } from '../storage/productRepository.js';
import { findReferences } from '../storage/referenceRepository.js';
import { describeStorageError, describeStorageReadError } from '../storage/storageError.js';

import { useProductStore } from './useProductStore.js';

/**
 * Completar o catalogo pela base de referencia, sem arquivo: a parte da tela
 * da base que grava produtos.
 *
 * A sequencia e a do Completar dados. Conferir le o catalogo, procura na base
 * os codigos dos produtos sem NCM ou sem codigo de barras e mostra o resumo;
 * nada e gravado. Confirmar le o catalogo e a base de novo e refaz o calculo
 * sobre eles, porque entre o resumo e o clique outra aba pode ter gravado no
 * mesmo banco, e grava numa transacao so. Quando a gravacao falha, nenhum
 * produto muda e o resumo continua na tela, com o motivo.
 *
 * Fica num arquivo proprio, espalhado no store da base, para que o estado
 * continue tendo um dono so.
 */

export const COMPLETION_FROM_BASE_STATUS = Object.freeze({
  IDLE: 'idle',
  CHECKING: 'checking',
  READY: 'ready',
  WRITING: 'writing',
  DONE: 'done',
});

async function planFromStorage() {
  const products = await listProducts();
  const codes = referenceCodesToAsk(products);
  const references = codes.length > 0 ? await findReferences(codes) : new Map();

  return planReferenceCompletion(products, references);
}

function initialCompletionState() {
  return {
    completionStatus: COMPLETION_FROM_BASE_STATUS.IDLE,
    completionPlan: null,
    completionError: null,
  };
}

export function createReferenceCompletionSlice(set, get) {
  return {
    ...initialCompletionState(),

    resetCompletion: () => {
      set(initialCompletionState());
    },

    checkCompletion: async () => {
      const { completionStatus } = get();

      if (
        completionStatus === COMPLETION_FROM_BASE_STATUS.CHECKING ||
        completionStatus === COMPLETION_FROM_BASE_STATUS.WRITING
      ) {
        return;
      }

      set({ ...initialCompletionState(), completionStatus: COMPLETION_FROM_BASE_STATUS.CHECKING });

      try {
        const plan = await planFromStorage();

        set({ completionStatus: COMPLETION_FROM_BASE_STATUS.READY, completionPlan: plan });
      } catch (error) {
        set({
          completionStatus: COMPLETION_FROM_BASE_STATUS.IDLE,
          completionError: describeStorageReadError(error),
        });
      }
    },

    confirmCompletion: async () => {
      if (get().completionStatus !== COMPLETION_FROM_BASE_STATUS.READY) {
        return;
      }

      set({ completionStatus: COMPLETION_FROM_BASE_STATUS.WRITING, completionError: null });

      let plan;

      try {
        plan = await planFromStorage();
        await updateProducts(plan.products);
      } catch (error) {
        set({
          completionStatus: COMPLETION_FROM_BASE_STATUS.READY,
          completionError: describeStorageError(error),
        });
        return;
      }

      set({ completionStatus: COMPLETION_FROM_BASE_STATUS.DONE, completionPlan: plan });

      if (plan.products.length === 0) {
        return;
      }

      // A releitura falhando nao desfaz a gravacao, que ja terminou: o motivo
      // fica em `loadError`, e a listagem o exibe com a acao de tentar de novo.
      await useProductStore
        .getState()
        .loadProducts()
        .catch(() => {});
    },
  };
}
