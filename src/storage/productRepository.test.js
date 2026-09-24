// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A tabela de produtos e trocada por uma tabela em memoria com as tres
 * operacoes que este arquivo exercita. O IndexedDB de verdade continua sendo
 * conferencia no navegador.
 */
const table = vi.hoisted(() => {
  const rows = new Map();

  return {
    rows,
    add: vi.fn(async (row) => {
      rows.set(row.id, row);
    }),
    toArray: vi.fn(async () => [...rows.values()]),
    clear: vi.fn(async () => {
      rows.clear();
    }),
  };
});

vi.mock('./indexed-db.js', () => ({ db: { products: table } }));

const { clearAllProducts, createProduct, listProducts } = await import('./productRepository.js');

function produto(id, systemCode) {
  return {
    id,
    systemCode,
    displayName: 'Produto inventado',
    priceInCentavos: 1000,
    createdAt: '2026-09-23T12:00:00.000Z',
    updatedAt: '2026-09-23T12:00:00.000Z',
  };
}

beforeEach(() => {
  table.rows.clear();
  vi.clearAllMocks();
});

describe('zerar a tabela de produtos', () => {
  it('deixa o repositorio vazio numa chamada so', async () => {
    await createProduct(produto('11111111-1111-4111-8111-111111111111', 'MOV-1'));
    await createProduct(produto('22222222-2222-4222-8222-222222222222', 'MOV-2'));

    expect(await listProducts()).toHaveLength(2);

    await clearAllProducts();

    expect(table.clear).toHaveBeenCalledTimes(1);
    expect(await listProducts()).toEqual([]);
  });
});
