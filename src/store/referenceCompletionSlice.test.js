// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Completar o catalogo pela base guardada, no store da tela da base: o resumo
 * antes de gravar, o calculo refeito na confirmacao e o que fica na tela
 * quando a gravacao falha. Os dois repositorios entram como duble.
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

const { COMPLETION_FROM_BASE_STATUS } = await import('./referenceCompletionSlice.js');
const { useReferenceStore } = await import('./useReferenceStore.js');
const { useProductStore } = await import('./useProductStore.js');

function product(fields) {
  return {
    id: `id-${fields.systemCode}`,
    priceInCentavos: 10000,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...fields,
  };
}

const WARDROBE = product({ systemCode: '01620', displayName: 'GUARDA ROUPA INVENTADO 6PTS' });
const STOVE = product({ systemCode: '118114', displayName: 'FOGAO INVENTADO 4 BOCAS', ncm: '73211100' });
const RACK = product({ systemCode: '5001', displayName: 'RACK INVENTADO' });

function baseLookup(codes) {
  const known = new Map([
    ['1620', { systemCode: '1620', ncm: '94035000', ean: '7890000000017' }],
    ['118114', { systemCode: '118114', ncm: '73211100', ean: '7890000000024' }],
  ]);

  return new Map(
    codes
      .filter((code) => known.has(code.replace(/^0+(?=\d)/, '')))
      .map((code) => [code, known.get(code.replace(/^0+(?=\d)/, ''))]),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useReferenceStore.getState().resetCompletion();
  useProductStore.setState({ products: [], isLoading: false, loadError: null });
  products.listProducts.mockResolvedValue([WARDROBE, STOVE, RACK]);
  products.updateProducts.mockImplementation(async (list) => list);
  references.findReferences.mockImplementation(async (codes) => baseLookup(codes));
});

describe('conferir o catalogo pela base', () => {
  it('procura na base so os codigos sem NCM ou sem codigo de barras e mostra o resumo, sem gravar', async () => {
    await useReferenceStore.getState().checkCompletion();

    const { completionStatus, completionPlan } = useReferenceStore.getState();

    expect(references.findReferences).toHaveBeenCalledWith(['01620', '118114', '5001']);
    expect(completionStatus).toBe(COMPLETION_FROM_BASE_STATUS.READY);
    expect(completionPlan.summary).toEqual(
      expect.objectContaining({ askedCodes: 3, updatedProducts: 2, outsideReference: 1 }),
    );
    expect(products.updateProducts).not.toHaveBeenCalled();
  });

  it('guarda o motivo quando a leitura falha', async () => {
    const error = new Error('falha inventada');
    error.name = 'DatabaseClosedError';
    references.findReferences.mockRejectedValue(error);

    await useReferenceStore.getState().checkCompletion();

    expect(useReferenceStore.getState().completionStatus).toBe(COMPLETION_FROM_BASE_STATUS.IDLE);
    expect(useReferenceStore.getState().completionError).toMatch(/conexão com o armazenamento/);
  });
});

describe('completar o catalogo pela base', () => {
  it('grava so os produtos que ganham campo, com o calculo refeito sobre o catalogo do momento', async () => {
    await useReferenceStore.getState().checkCompletion();

    // Entre o resumo e o clique, o fogao ganhou codigo de barras em outra aba.
    products.listProducts.mockResolvedValue([WARDROBE, { ...STOVE, ean: '7890000000099' }, RACK]);

    await useReferenceStore.getState().confirmCompletion();

    const written = products.updateProducts.mock.calls[0][0];

    expect(products.updateProducts).toHaveBeenCalledTimes(1);
    expect(written).toHaveLength(1);
    expect(written[0]).toEqual(
      expect.objectContaining({ id: WARDROBE.id, ncm: '94035000', ean: '7890000000017' }),
    );
    expect(useReferenceStore.getState().completionStatus).toBe(COMPLETION_FROM_BASE_STATUS.DONE);
    expect(useReferenceStore.getState().completionPlan.summary.updatedProducts).toBe(1);
    expect(products.createProduct).not.toHaveBeenCalled();
    expect(references.replaceReferenceEntries).not.toHaveBeenCalled();
  });

  it('mantem o resumo e o motivo quando a gravacao falha', async () => {
    const error = new Error('falha inventada');
    error.name = 'QuotaExceededError';
    products.updateProducts.mockRejectedValue(error);

    await useReferenceStore.getState().checkCompletion();
    await useReferenceStore.getState().confirmCompletion();

    const state = useReferenceStore.getState();

    expect(state.completionStatus).toBe(COMPLETION_FROM_BASE_STATUS.READY);
    expect(state.completionPlan.summary.updatedProducts).toBe(2);
    expect(state.completionError).toMatch(/está cheio/);
  });

  it('nao grava sem conferir antes', async () => {
    await useReferenceStore.getState().confirmCompletion();

    expect(products.listProducts).not.toHaveBeenCalled();
    expect(products.updateProducts).not.toHaveBeenCalled();
  });
});
