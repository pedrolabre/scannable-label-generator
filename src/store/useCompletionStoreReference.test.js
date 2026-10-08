// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HEADER_ROW, productRow, singleSheetOds } from '../domain/services/odsFixtures.js';
import { bytesOf, footer, stockHeader, stockRow } from '../domain/services/txtReportFixtures.js';

/**
 * A base de referencia no caminho do Completar dados: o arquivo em colunas com
 * NCM ou codigo de barras monta as linhas na leitura, com a previa do que muda
 * na base, e a confirmacao atualiza a base codigo por codigo, depois do
 * catalogo. Os dois repositorios entram como duble; o que se prova e quando a
 * base e gravada, com o que, e o que acontece quando a gravacao dela falha.
 */

const products = vi.hoisted(() => ({
  clearAllProducts: vi.fn(),
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listProducts: vi.fn(),
  updateProduct: vi.fn(),
  updateProducts: vi.fn(),
}));

const references = vi.hoisted(() => ({
  clearReferenceEntries: vi.fn(),
  findReference: vi.fn(),
  findReferences: vi.fn(),
  getReferenceStats: vi.fn(),
  mergeReferenceEntries: vi.fn(),
  previewReferenceLoad: vi.fn(),
  replaceReferenceBase: vi.fn(),
  replaceReferenceEntries: vi.fn(),
}));

vi.mock('../storage/productRepository.js', () => products);
vi.mock('../storage/referenceRepository.js', () => references);

const { COMPLETION_STATUS, useCompletionStore } = await import('./useCompletionStore.js');
const { useProductStore } = await import('./useProductStore.js');

const WARDROBE = Object.freeze({
  id: '11111111-1111-4111-8111-111111111111',
  systemCode: '01620',
  displayName: 'GUARDA ROUPA INVENTADO',
  priceInCentavos: 129990,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
});

const SHEET_ROWS = [
  productRow({ code: 1620, description: 'GUARDA ROUPA INVENTADO', barcode: '7890000000017', ncm: '94035000' }),
  productRow({ code: 118114, description: 'FOGAO INVENTADO', ncm: '73211100' }),
  productRow({ code: 5001, description: 'RACK INVENTADO', ncm: '9403500' }),
];

const STOCK_REPORT = bytesOf([
  ...stockHeader(1),
  'Grupo: 21-MOVEIS',
  stockRow({ code: '001620', description: 'GUARDA ROUPA INVENTADO 6PTS' }),
  ...footer(1),
]);

async function sheetFile() {
  return new File([await singleSheetOds([HEADER_ROW, ...SHEET_ROWS])], 'cadastro.ods');
}

async function readSheet(...others) {
  await useCompletionStore.getState().readFiles([await sheetFile(), ...others]);
}

beforeEach(() => {
  vi.clearAllMocks();
  useCompletionStore.getState().reset();
  useProductStore.setState({ products: [WARDROBE], isLoading: false, loadError: null });
  products.listProducts.mockResolvedValue([WARDROBE]);
  products.updateProducts.mockImplementation(async (list) => list);
  references.mergeReferenceEntries.mockImplementation(async (entries) => ({
    added: entries.length,
    updated: 0,
    unchanged: 0,
  }));
  references.previewReferenceLoad.mockResolvedValue({ added: 1, updated: 1, unchanged: 0, removedOnReplace: 4 });
});

const MERGED = { added: 2, updated: 0, unchanged: 0 };

describe('leitura', () => {
  it('monta as linhas da base com o resumo, sem gravar nada', async () => {
    await readSheet();

    const { status, reference } = useCompletionStore.getState();

    expect(status).toBe(COMPLETION_STATUS.READY);
    expect(reference.entries).toEqual([
      { comparableCode: '1620', systemCode: '1620', ncm: '94035000', ean: '7890000000017' },
      { comparableCode: '118114', systemCode: '118114', ncm: '73211100' },
    ]);
    expect(reference.summary).toEqual(
      expect.objectContaining({ recordCount: 3, entryCount: 2, invalidNcm: 1, unusable: 1 }),
    );
    expect(reference.preview).toEqual({ added: 1, updated: 1, unchanged: 0, removedOnReplace: 4 });
    expect(references.previewReferenceLoad).toHaveBeenCalledWith(reference.entries);
    expect(references.mergeReferenceEntries).not.toHaveBeenCalled();
    expect(products.updateProducts).not.toHaveBeenCalled();
  });

  it('monta a base so com as linhas da planilha, e nao com as do relatorio', async () => {
    await readSheet(new File([STOCK_REPORT], 'saldo.TXT'));

    expect(useCompletionStore.getState().reference.summary.recordCount).toBe(3);
  });

  it('segue sem a previa quando a leitura da base falha', async () => {
    references.previewReferenceLoad.mockRejectedValueOnce(new Error('falha'));

    await readSheet();

    const { status, reference } = useCompletionStore.getState();

    expect(status).toBe(COMPLETION_STATUS.READY);
    expect(reference.entries).toHaveLength(2);
    expect(reference.preview).toBeNull();
  });

  it('nao monta base quando o lote nao tem planilha', async () => {
    await useCompletionStore.getState().readFiles([new File([STOCK_REPORT], 'saldo.TXT')]);

    expect(useCompletionStore.getState().reference).toBeNull();
  });
});

describe('confirmacao', () => {
  it('completa o catalogo e depois atualiza a base com as linhas da planilha', async () => {
    await readSheet();
    await useCompletionStore.getState().confirm();

    expect(products.updateProducts).toHaveBeenCalledTimes(1);
    expect(products.updateProducts.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: WARDROBE.id, ncm: '94035000', ean: '7890000000017' }),
    ]);
    expect(references.mergeReferenceEntries).toHaveBeenCalledTimes(1);
    expect(references.mergeReferenceEntries.mock.calls[0][0]).toHaveLength(2);
    expect(references.replaceReferenceEntries).not.toHaveBeenCalled();
    expect(references.replaceReferenceBase).not.toHaveBeenCalled();
    expect(products.updateProducts.mock.invocationCallOrder[0]).toBeLessThan(
      references.mergeReferenceEntries.mock.invocationCallOrder[0],
    );
    expect(useCompletionStore.getState().status).toBe(COMPLETION_STATUS.DONE);
    expect(useCompletionStore.getState().referenceResult).toEqual(MERGED);
  });

  it('guarda a base mesmo com o catalogo vazio, sem criar produto', async () => {
    products.listProducts.mockResolvedValue([]);

    await readSheet();
    await useCompletionStore.getState().confirm();

    expect(products.updateProducts).toHaveBeenCalledWith([]);
    expect(products.createProduct).not.toHaveBeenCalled();
    expect(references.mergeReferenceEntries).toHaveBeenCalledTimes(1);
    expect(useCompletionStore.getState().result.updatedProducts).toBe(0);
    expect(useCompletionStore.getState().referenceResult).toEqual(MERGED);
  });

  it('nao toca a base quando o lote nao tem planilha', async () => {
    await useCompletionStore.getState().readFiles([new File([STOCK_REPORT], 'saldo.TXT')]);
    await useCompletionStore.getState().confirm();

    expect(references.mergeReferenceEntries).not.toHaveBeenCalled();
    expect(useCompletionStore.getState().referenceResult).toBeNull();
  });

  it('volta ao resumo com o motivo e rele o catalogo ja gravado quando a base falha', async () => {
    references.mergeReferenceEntries.mockRejectedValueOnce(
      Object.assign(new Error('x'), { name: 'QuotaExceededError' }),
    );

    await readSheet();

    const loadProducts = vi.spyOn(useProductStore.getState(), 'loadProducts');

    await useCompletionStore.getState().confirm();

    const { status, error, referenceResult } = useCompletionStore.getState();

    expect(status).toBe(COMPLETION_STATUS.READY);
    expect(error).toBe('O armazenamento deste dispositivo está cheio. Libere espaço no navegador e tente de novo.');
    expect(referenceResult).toBeNull();
    expect(loadProducts).toHaveBeenCalledTimes(1);
  });

  it('nao grava a base quando a gravacao do catalogo falha', async () => {
    products.updateProducts.mockRejectedValueOnce(new Error('falha'));

    await readSheet();
    await useCompletionStore.getState().confirm();

    expect(references.mergeReferenceEntries).not.toHaveBeenCalled();
    expect(useCompletionStore.getState().status).toBe(COMPLETION_STATUS.READY);
  });
});
