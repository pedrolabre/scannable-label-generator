import { create } from 'zustand';

import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct as updateStoredProduct,
} from '../storage/productRepository.js';
import { describeStorageReadError } from '../storage/storageError.js';

// Leitura em andamento. Chamadas concorrentes reaproveitam a mesma promessa em
// vez de disparar uma segunda varredura da tabela.
let pendingLoad = null;

/**
 * `put` e `delete` alcancam um registro que ja existe, e o registro que a tela
 * carrega pode estar velho em relacao ao banco — outra aba com a mesma
 * aplicacao aberta grava no mesmo IndexedDB. Quando uma dessas duas escritas
 * falha, a lista em memoria deixa de ser confiavel, entao a tabela e relida
 * antes de o erro subir para quem chamou.
 *
 * A releitura falhando nao troca o erro que o chamador precisa ver: ela ja
 * registra o proprio motivo em `loadError`.
 */
async function writeAndReconcileOnFailure(write, reload) {
  try {
    return await write();
  } catch (error) {
    await reload().catch(() => {});

    throw error;
  }
}

export const useProductStore = create((set, get) => ({
  products: [],
  isLoading: false,
  loadError: null,

  loadProducts: () => {
    if (pendingLoad) {
      return pendingLoad;
    }

    set({ isLoading: true, loadError: null });

    pendingLoad = listProducts()
      .then((products) => {
        set({ products, isLoading: false });
        return products;
      })
      .catch((error) => {
        set({ isLoading: false, loadError: describeStorageReadError(error) });
        throw error;
      })
      .finally(() => {
        pendingLoad = null;
      });

    return pendingLoad;
  },

  // `add` rejeita sem gravar: quando ele falha, banco e memoria continuam
  // identicos ao que eram antes da chamada, e nao ha o que reconciliar.
  addProduct: async (product) => {
    const stored = await createProduct(product);

    set({ products: [...get().products, stored] });

    return stored;
  },

  updateProduct: async (product) => {
    const stored = await writeAndReconcileOnFailure(
      () => updateStoredProduct(product),
      get().loadProducts,
    );

    set({
      products: get().products.map((current) => (current.id === stored.id ? stored : current)),
    });

    return stored;
  },

  removeProduct: async (id) => {
    await writeAndReconcileOnFailure(() => deleteProduct(id), get().loadProducts);

    set({ products: get().products.filter((product) => product.id !== id) });
  },
}));
