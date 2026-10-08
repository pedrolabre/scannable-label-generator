// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HEADER_ROW, productRow, singleSheetOds } from '../domain/services/odsFixtures.js';
import { bytesOf, footer, priceHeader, priceRow } from '../domain/services/txtReportFixtures.js';

/**
 * A tela da base no store: as estatisticas, a carga por arquivo — atualizando
 * ou trocando a base — e o apagar.
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
  mergeReferenceEntries: vi.fn(),
  previewReferenceLoad: vi.fn(),
  replaceReferenceBase: vi.fn(),
  replaceReferenceEntries: vi.fn(),
}));

vi.mock('../storage/productRepository.js', () => products);
vi.mock('../storage/referenceRepository.js', () => references);

const { SHEET_LOAD_MODE, SHEET_STATUS, useReferenceStore } = await import('./useReferenceStore.js');

const LOADED = { total: 3, withNcm: 3, withEan: 1, loadedAt: '2026-09-30T15:00:00.000Z' };

const PREVIEW = { added: 1, updated: 1, unchanged: 0, removedOnReplace: 3 };

const ENTRIES = [
  { comparableCode: '1620', systemCode: '1620', ncm: '94035000', ean: '7890000000017' },
  { comparableCode: '118114', systemCode: '118114', ncm: '73211100' },
];

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
  references.mergeReferenceEntries.mockResolvedValue({ added: 1, updated: 1, unchanged: 0 });
  references.replaceReferenceBase.mockImplementation(async (entries) => ({
    entryCount: entries.length,
    removed: 3,
  }));
  references.previewReferenceLoad.mockResolvedValue(PREVIEW);
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

describe('carga por arquivo', () => {
  it('le a planilha e monta as linhas com a previa, sem gravar nada', async () => {
    await useReferenceStore.getState().readSheet([await sheetFile()]);

    const state = useReferenceStore.getState();

    expect(state.sheetStatus).toBe(SHEET_STATUS.READY);
    expect(state.sheetReference.summary).toEqual(
      expect.objectContaining({ entryCount: 2, withNcm: 2, withEan: 1, invalidNcm: 1 }),
    );
    expect(state.sheetReference.preview).toEqual(PREVIEW);
    expect(references.previewReferenceLoad).toHaveBeenCalledWith(ENTRIES);
    expect(references.mergeReferenceEntries).not.toHaveBeenCalled();
    expect(references.replaceReferenceBase).not.toHaveBeenCalled();
    expect(writesToCatalog()).toBe(0);
  });

  it('le o mesmo cadastro salvo como .txt separado por tabulacao', async () => {
    const rows = [
      ['Código', 'Descrição', 'NCM', 'Cód. Barras'],
      ['1620', 'GUARDA ROUPA INVENTADO', '94035000', '7890000000017'],
      ['118114', 'FOGAO INVENTADO', '73211100', ''],
    ];
    const txt = new File([rows.map((row) => row.join('\t')).join('\r\n')], 'cadastro.txt');

    await useReferenceStore.getState().readSheet([txt]);

    expect(useReferenceStore.getState().sheetStatus).toBe(SHEET_STATUS.READY);
    expect(useReferenceStore.getState().sheetReference.entries).toEqual(ENTRIES);
  });

  it('atualiza a base codigo por codigo na confirmacao, rele as estatisticas e nao toca o catalogo', async () => {
    await useReferenceStore.getState().readSheet([await sheetFile()]);
    await useReferenceStore.getState().confirmSheet();

    const state = useReferenceStore.getState();

    expect(references.mergeReferenceEntries).toHaveBeenCalledTimes(1);
    expect(references.mergeReferenceEntries.mock.calls[0][0]).toEqual(ENTRIES);
    expect(references.replaceReferenceBase).not.toHaveBeenCalled();
    expect(state.sheetStatus).toBe(SHEET_STATUS.DONE);
    expect(state.sheetResult).toEqual({ mode: 'merge', added: 1, updated: 1, unchanged: 0 });
    expect(references.getReferenceStats).toHaveBeenCalledTimes(1);
    expect(products.listProducts).not.toHaveBeenCalled();
    expect(writesToCatalog()).toBe(0);
  });

  it('troca a base inteira quando pedido, e diz quantos codigos sairam', async () => {
    await useReferenceStore.getState().readSheet([await sheetFile()]);
    await useReferenceStore.getState().confirmSheet(SHEET_LOAD_MODE.REPLACE);

    const state = useReferenceStore.getState();

    expect(references.replaceReferenceBase).toHaveBeenCalledWith(ENTRIES);
    expect(references.mergeReferenceEntries).not.toHaveBeenCalled();
    expect(state.sheetResult).toEqual({ mode: 'replace', entryCount: 2, removed: 3 });
    expect(writesToCatalog()).toBe(0);
  });

  it('mantem o resumo e o motivo quando a gravacao da base falha', async () => {
    references.mergeReferenceEntries.mockRejectedValue(storageFailure('QuotaExceededError'));

    await useReferenceStore.getState().readSheet([await sheetFile()]);
    await useReferenceStore.getState().confirmSheet();

    const state = useReferenceStore.getState();

    expect(state.sheetStatus).toBe(SHEET_STATUS.READY);
    expect(state.sheetReference.entries).toHaveLength(2);
    expect(state.sheetError).toMatch(/está cheio/);
    expect(references.getReferenceStats).not.toHaveBeenCalled();
  });

  it('nao oferece carga quando o arquivo nao tem NCM nem codigo de barras', async () => {
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
    expect(state.sheetFiles.map((file) => file.status)).toEqual(['parsed']);
    expect(state.sheetReference).toBeNull();
    expect(state.sheetError).toBe(
      'Nenhum arquivo escolhido traz coluna de NCM ou de código de barras; a base fica como está.',
    );
    expect(references.mergeReferenceEntries).not.toHaveBeenCalled();
  });

  it('recusa a nota fiscal como formato nao aceito', async () => {
    await useReferenceStore.getState().readSheet([new File(['<nfeProc/>'], 'nota.xml')]);

    const state = useReferenceStore.getState();

    expect(state.sheetFiles[0].status).toBe('rejected');
    expect(state.sheetFiles[0].error).toBe('Formato não aceito. Escolha arquivos .ods, .csv, .json, .txt.');
    expect(state.sheetError).toBeNull();
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
