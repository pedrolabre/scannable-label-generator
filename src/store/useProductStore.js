import { create } from 'zustand';

import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct as updateStoredProduct,
} from '../storage/productRepository.js';

// Leitura em andamento. Chamadas concorrentes reaproveitam a mesma promessa em
// vez de disparar uma segunda varredura da tabela.
let pendingLoad = null;

export const useProductStore = create((set, get) => ({
  products: [],
  isLoading: false,

  loadProducts: () => {
    if (pendingLoad) {
      return pendingLoad;
    }

    set({ isLoading: true });

    pendingLoad = listProducts()
      .then((products) => {
        set({ products, isLoading: false });
        return products;
      })
      .catch((error) => {
        set({ isLoading: false });
        throw error;
      })
      .finally(() => {
        pendingLoad = null;
      });

    return pendingLoad;
  },

  addProduct: async (product) => {
    const stored = await createProduct(product);

    set({ products: [...get().products, stored] });

    return stored;
  },

  updateProduct: async (product) => {
    const stored = await updateStoredProduct(product);

    set({
      products: get().products.map((current) => (current.id === stored.id ? stored : current)),
    });

    return stored;
  },

  removeProduct: async (id) => {
    await deleteProduct(id);

    set({ products: get().products.filter((product) => product.id !== id) });
  },
}));
