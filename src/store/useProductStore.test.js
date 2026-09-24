// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
  clearAllProducts: vi.fn(),
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listProducts: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock('../storage/productRepository.js', () => repository);

const { useProductStore } = await import('./useProductStore.js');

const PRODUTOS = [{ id: 'a' }, { id: 'b' }];

beforeEach(() => {
  vi.clearAllMocks();
  useProductStore.setState({ products: PRODUTOS, isLoading: false, loadError: null });
});

describe('zerar o catalogo', () => {
  it('limpa o banco e zera a lista em memoria', async () => {
    repository.clearAllProducts.mockResolvedValue(undefined);

    await useProductStore.getState().clearAllProducts();

    expect(repository.clearAllProducts).toHaveBeenCalledTimes(1);
    expect(useProductStore.getState().products).toEqual([]);
  });

  it('relê o banco e deixa a falha subir quando a limpeza nao termina', async () => {
    const falha = new Error('armazenamento indisponível');

    repository.clearAllProducts.mockRejectedValue(falha);
    repository.listProducts.mockResolvedValue(PRODUTOS);

    await expect(useProductStore.getState().clearAllProducts()).rejects.toBe(falha);
    expect(repository.listProducts).toHaveBeenCalledTimes(1);
    expect(useProductStore.getState().products).toEqual(PRODUTOS);
  });
});
