// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A regravacao de varios produtos numa transacao so. A tabela e trocada por uma
 * em memoria, e a transacao por uma que so executa a escrita e deixa a falha
 * subir; o IndexedDB de verdade continua sendo conferencia no navegador.
 */
const db = vi.hoisted(() => {
  const rows = new Map();

  return {
    rows,
    transaction: vi.fn(async (mode, table, write) => write()),
    products: {
      bulkPut: vi.fn(async (list) => {
        for (const row of list) {
          rows.set(row.id, row);
        }
      }),
    },
  };
});

vi.mock('./indexed-db.js', () => ({ db }));

const { updateProducts } = await import('./productRepository.js');

function produto(id, overrides = {}) {
  return {
    id,
    systemCode: 'MOV-1',
    displayName: 'Rack inventado',
    priceInCentavos: 49990,
    createdAt: '2026-09-23T12:00:00.000Z',
    updatedAt: '2026-09-30T12:00:00.000Z',
    ...overrides,
  };
}

const PRIMEIRO = '11111111-1111-4111-8111-111111111111';
const SEGUNDO = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  db.rows.clear();
  vi.clearAllMocks();
});

describe('updateProducts', () => {
  it('grava o conjunto inteiro numa transacao e numa escrita so', async () => {
    await updateProducts([produto(PRIMEIRO, { ncm: '94035000' }), produto(SEGUNDO, { ean: '7890000000017' })]);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.products.bulkPut).toHaveBeenCalledTimes(1);
    expect(db.rows.get(PRIMEIRO).ncm).toBe('94035000');
    expect(db.rows.get(SEGUNDO).ean).toBe('7890000000017');
  });

  it('nao grava nenhum produto quando um deles esta fora do contrato', async () => {
    await expect(
      updateProducts([produto(PRIMEIRO, { ncm: '94035000' }), produto(SEGUNDO, { ncm: '3909409' })]),
    ).rejects.toThrow();

    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.rows.size).toBe(0);
  });

  it('deixa a falha da transacao subir para quem chamou', async () => {
    const falha = new Error('transacao abortada');

    db.transaction.mockRejectedValueOnce(falha);

    await expect(updateProducts([produto(PRIMEIRO, { ncm: '94035000' })])).rejects.toBe(falha);
    expect(db.rows.size).toBe(0);
  });

  it('nao abre transacao para um conjunto vazio', async () => {
    await expect(updateProducts([])).resolves.toEqual([]);

    expect(db.transaction).not.toHaveBeenCalled();
  });
});
