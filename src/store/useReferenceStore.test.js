// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HEADER_ROW, productRow, singleSheetOds } from '../domain/services/odsFixtures.js';
import { bytesOf, footer, priceHeader, priceRow } from '../domain/services/txtReportFixtures.js';

/**
 * A tela da base no store: as estatisticas, a carga pela planilha e o apagar.
 * Os dois repositorios entram como duble; o que se prova e o que e gravado, o
 * que nunca e tocado — o catalogo — e o que fica na tela quando o armazenamento
 * falha.
 */

const products = vi.hoisted(() => ({
  clearAllProducts: vi.fn(),
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listProducts: vi.fn(),
  replaceAllProducts: vi.fn(),
  runProductsTransaction: vi.fn(),
  updateProduct: vi.fn(),
  updateProducts: vi.fn(),
}));

const references = vi.hoisted(() => ({
  clearReferenceEntries: vi.fn(),
  findReference: vi.fn(),
  findReferences: vi.fn(),
  getReferenceStats: vi.fn(),
  replaceReferenceEntries: vi.fn(),
}));

vi.mock('../storage/productRepository.js', () => products);
vi.mock('../storage/referenceRepository.js', () => references);

const { SHEET_STATUS, useReferenceStore } = await import('./useReferenceStore.js');

const LOADED = { total: 3, withNcm: 3, withEan: 1, loadedAt: '2026-09-30T15:00:00.000Z' };

const SHEET_ROWS = [
  productRow({ code: 1620, description: 'GUARDA ROUPA INVENTADO', barcode: '7890000000017', ncm: '94035000' }),
  productRow({ code: 118114, description: 'FOGAO INVENTADO', ncm: '73211100' }),
  productRow({ code: 5001, description: 'RACK INVENTADO', ncm: '9403500' }),
];

async function sheetFile() {
  return new File([await singleSheetOds([HEADER_ROW, ...SHEET_ROWS])], 'cadastro.ods');
}

function writesToCatalog() {
  return [
    products.clearAllProducts,
    products.createProduct,
    products.deleteProduct,
    products.replaceAllProducts,
    products.runProductsTransaction,
    products.updateProduct,
    products.updateProducts,
  ].reduce((sum, write) => sum + write.mock.calls.length, 0);
}

function storageFailure(name) {
  const error = new Error('falha inventada');
  error.name = name;
  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
  useReferenceStore.setState({ stats: null, isLoadingStats: false, statsError: null });
  useReferenceStore.getState().resetSheet();
  useReferenceStore.getState().resetCompletion();
  references.getReferenceStats.mockResolvedValue(LOADED);
  references.replaceReferenceEntries.mockImplementation(async (entries) => entries.length);
  references.clearReferenceEntries.mockResolvedValue(undefined);
});

describe('estatisticas', () => {
  it('le o total, os com NCM, os com codigo de barras e a data da carga', async () => {
    await useReferenceStore.getState().loadStats();

    expect(useReferenceStore.getState()).toEqual(
      expect.objectContaining({ stats: LOADED, isLoadingStats: false, statsError: null }),
    );
  });

  it('guarda o motivo quando a leitura da base falha', async () => {
    references.getReferenceStats.mockRejectedValue(storageFailure('InvalidStateError'));

    await useReferenceStore.getState().loadStats();

    expect(useReferenceStore.getState().stats).toBeNull();
    expect(useReferenceStore.getState().statsError).toMatch(/bloqueando o armazenamento local/);
  });
});

describe('carga pela planilha', () => {
  it('le a planilha e monta as linhas, sem gravar nada', async () => {
    await useReferenceStore.getState().readSheet([await sheetFile()]);

    const state = useReferenceStore.getState();

    expect(state.sheetStatus).toBe(SHEET_STATUS.READY);
    expect(state.sheetReference.summary).toEqual(
      expect.objectContaining({ entryCount: 2, withNcm: 2, withEan: 1, invalidNcm: 1 }),
    );
    expect(references.replaceReferenceEntries).not.toHaveBeenCalled();
    expect(writesToCatalog()).toBe(0);
  });

  it('troca a base inteira na confirmacao, relê as estatisticas e nao toca o catalogo', async () => {
    await useReferenceStore.getState().readSheet([await sheetFile()]);
    await useReferenceStore.getState().confirmSheet();

    const state = useReferenceStore.getState();

    expect(references.replaceReferenceEntries).toHaveBeenCalledTimes(1);
    expect(references.replaceReferenceEntries.mock.calls[0][0]).toEqual([
      { comparableCode: '1620', systemCode: '1620', ncm: '94035000', ean: '7890000000017' },
      { comparableCode: '118114', systemCode: '118114', ncm: '73211100' },
    ]);
    expect(state.sheetStatus).toBe(SHEET_STATUS.DONE);
    expect(state.sheetResult).toEqual({ entryCount: 2 });
    expect(references.getReferenceStats).toHaveBeenCalledTimes(1);
    expect(products.listProducts).not.toHaveBeenCalled();
    expect(writesToCatalog()).toBe(0);
  });

  it('mantem o resumo e o motivo quando a gravacao da base falha', async () => {
    references.replaceReferenceEntries.mockRejectedValue(storageFailure('QuotaExceededError'));

    await useReferenceStore.getState().readSheet([await sheetFile()]);
    await useReferenceStore.getState().confirmSheet();

    const state = useReferenceStore.getState();

    expect(state.sheetStatus).toBe(SHEET_STATUS.READY);
    expect(state.sheetReference.entries).toHaveLength(2);
    expect(state.sheetError).toMatch(/está cheio/);
    expect(references.getReferenceStats).not.toHaveBeenCalled();
  });

  it('recusa o arquivo que nao e planilha .ods e nao oferece carga', async () => {
    const report = new File(
      [
        bytesOf([
          ...priceHeader(1),
          priceRow({ code: '01620', description: 'GUARDA ROUPA INVENTADO' }),
          ...footer(1),
        ]),
      ],
      'tabela-inventada.txt',
    );

    await useReferenceStore.getState().readSheet([report]);
    await useReferenceStore.getState().confirmSheet();

    const state = useReferenceStore.getState();

    expect(state.sheetStatus).toBe(SHEET_STATUS.IDLE);
    expect(state.sheetFiles.map((file) => file.status)).toEqual(['rejected']);
    expect(state.sheetReference).toBeNull();
    expect(references.replaceReferenceEntries).not.toHaveBeenCalled();
  });
});

describe('apagar a base', () => {
  it('apaga a base, relê as estatisticas e nao toca o catalogo', async () => {
    references.getReferenceStats.mockResolvedValue({ total: 0, withNcm: 0, withEan: 0, loadedAt: null });

    await useReferenceStore.getState().clearBase();

    expect(references.clearReferenceEntries).toHaveBeenCalledTimes(1);
    expect(useReferenceStore.getState().stats.total).toBe(0);
    expect(writesToCatalog()).toBe(0);
  });

  it('deixa a falha subir para quem confirmou, sem reler as estatisticas', async () => {
    references.clearReferenceEntries.mockRejectedValue(storageFailure('AbortError'));

    await expect(useReferenceStore.getState().clearBase()).rejects.toThrow('falha inventada');
    expect(references.getReferenceStats).not.toHaveBeenCalled();
  });
});
