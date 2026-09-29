// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductSchema } from '../domain/schemas/productSchema.js';
import { CONFLICT_KIND_CATALOG, CONFLICT_KIND_IDENTICAL } from '../domain/services/importConflict.js';
import { candidateForRecord } from '../domain/services/importCorrection.js';
import { RECORD_STATUS_READY } from '../domain/services/importReport.js';
import { bytesOf, footer, priceHeader, priceRow, stockHeader, stockRow } from '../domain/services/txtReportFixtures.js';

/**
 * A base de referencia no caminho da importacao: a busca acontece no store,
 * uma vez por lote, entre a leitura e a conferencia. Os dois repositorios
 * entram como duble; o que se prova e o que a conferencia, a deteccao de
 * codigo repetido, a correcao e a gravacao enxergam depois do enriquecimento.
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

const { useImportStore } = await import('./useImportStore.js');
const { useCompletionStore } = await import('./useCompletionStore.js');
const { useProductStore } = await import('./useProductStore.js');

const WARDROBE_REFERENCE = { systemCode: '1620', ncm: '94035000', ean: '7890000000017' };
const STOVE_REFERENCE = { systemCode: '118114', ncm: '73211100' };

// A base como a busca em lista a devolve: so os codigos que ela tem.
function baseLookup(codes) {
  const known = new Map([
    ['1620', WARDROBE_REFERENCE],
    ['118114', STOVE_REFERENCE],
  ]);

  return new Map(
    codes
      .filter((code) => known.has(code.replace(/^0+(?=\d)/, '')))
      .map((code) => [code, known.get(code.replace(/^0+(?=\d)/, ''))]),
  );
}

const PRICE_REPORT = bytesOf([
  ...priceHeader(1),
  priceRow({ code: '01620', description: 'GUARDA ROUPA INVENTADO 6PTS', price: '1.299,90' }),
  priceRow({ code: '118114', description: 'FOGAO INVENTADO 4 BOCAS', price: '899,00' }),
  priceRow({ code: '777777', description: 'POLTRONA INVENTADA', price: '450,00' }),
  ...footer(3),
]);

const SECOND_PRICE_REPORT = bytesOf([
  ...priceHeader(1),
  priceRow({ code: '118114', description: 'FOGAO INVENTADO 4 BOCAS', price: '899,00' }),
  ...footer(1),
]);

const STOCK_REPORT = bytesOf([
  ...stockHeader(1),
  'Grupo: 21-MOVEIS',
  stockRow({ code: '001620', description: 'GUARDA ROUPA INVENTADO 6PTS' }),
  ...footer(1),
]);

function reportFile(bytes, name = 'tabela-inventada.txt') {
  return new File([bytes], name);
}

async function importFiles(...files) {
  await useImportStore.getState().parseFiles(files);

  return useImportStore.getState();
}

function storedFrom(candidate, fields = {}) {
  return {
    ...candidate,
    ...fields,
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useImportStore.getState().reset();
  useCompletionStore.getState().reset();
  useProductStore.setState({ products: [], isLoading: false, loadError: null });
  products.listProducts.mockResolvedValue([]);
  products.createProduct.mockImplementation(async (product) => product);
  products.updateProduct.mockImplementation(async (product) => product);
  products.updateProducts.mockImplementation(async (list) => list);
  products.runProductsTransaction.mockImplementation(async (write) => write());
  references.findReferences.mockImplementation(async (codes) => baseLookup(codes));
});

describe('parseFiles com a base de referencia', () => {
  it('leva a linha da Tabela de Preco sem NCM a conferencia com o NCM da base', async () => {
    const { records, report, enrichmentSummary, referenceError } = await importFiles(reportFile(PRICE_REPORT));

    expect(records[0].candidate).toEqual(expect.objectContaining({ systemCode: '01620', ncm: '94035000', ean: '7890000000017' }));
    expect(records[0].enrichedFields).toEqual(['ncm', 'ean']);
    expect(report.entries.get(records[0].recordId).status).toBe(RECORD_STATUS_READY);
    expect(records[2].candidate).not.toHaveProperty('ncm');
    expect(report.entries.get(records[2].recordId).status).toBe(RECORD_STATUS_READY);
    expect(enrichmentSummary).toEqual(
      expect.objectContaining({ lookedUp: 3, found: 2, notFound: 1, enriched: 2, gainedByField: { ncm: 2, ean: 1 } }),
    );
    expect(referenceError).toBeNull();
  });

  it('consulta a base uma vez por lote, com os codigos distintos', async () => {
    await importFiles(reportFile(PRICE_REPORT), reportFile(SECOND_PRICE_REPORT, 'outra.txt'), reportFile(STOCK_REPORT, 'saldo.TXT'));

    expect(references.findReferences).toHaveBeenCalledTimes(1);
    expect(references.findReferences.mock.calls[0][0]).toEqual(['01620', '118114', '777777', '001620']);
  });

  it('consulta a base antes de ler o catalogo para a deteccao de codigo repetido', async () => {
    await importFiles(reportFile(PRICE_REPORT));

    expect(references.findReferences.mock.invocationCallOrder[0]).toBeLessThan(
      products.listProducts.mock.invocationCallOrder[0],
    );
  });

  it('leva o saldo de estoque completado e ainda recusado pela falta de preco', async () => {
    const { records, report } = await importFiles(reportFile(STOCK_REPORT, 'saldo.TXT'));
    const entry = report.entries.get(records[0].recordId);

    expect(records[0].candidate.ncm).toBe('94035000');
    expect(entry.lines.map((line) => line.field)).toEqual(['priceInCentavos']);
  });

  it('com a base vazia, o lote chega a conferencia como chegaria sem ela', async () => {
    references.findReferences.mockResolvedValue(new Map());

    const { records, enrichmentSummary, referenceError } = await importFiles(reportFile(PRICE_REPORT));

    expect(records.every((record) => !('ncm' in record.candidate) && !('enrichedFields' in record))).toBe(true);
    expect(enrichmentSummary).toEqual(expect.objectContaining({ lookedUp: 3, found: 0, enriched: 0 }));
    expect(referenceError).toBeNull();
  });

  it('com a leitura da base falhando, segue o lote sem completar e guarda o motivo', async () => {
    references.findReferences.mockRejectedValue(Object.assign(new Error('x'), { name: 'InvalidStateError' }));

    const { records, report, enrichmentSummary, referenceError, catalogError } = await importFiles(reportFile(PRICE_REPORT));

    expect(records.some((record) => 'ncm' in record.candidate)).toBe(false);
    expect(report.readyCount).toBe(3);
    expect(enrichmentSummary).toBeNull();
    expect(referenceError).toBe(
      'Este navegador está bloqueando o armazenamento local. Verifique as permissões do site e tente de novo.',
    );
    expect(catalogError).toBeNull();
  });

  it('limpa as contagens e o motivo ao descartar o lote', async () => {
    await importFiles(reportFile(PRICE_REPORT));
    useImportStore.getState().reset();

    expect(useImportStore.getState().enrichmentSummary).toBeNull();
    expect(useImportStore.getState().referenceError).toBeNull();
  });
});

describe('deteccao de codigo repetido depois do enriquecimento', () => {
  it('ve como identico o produto do catalogo que ja tem o mesmo NCM e codigo de barras', async () => {
    references.findReferences.mockResolvedValue(new Map());

    const plain = (await importFiles(reportFile(PRICE_REPORT))).records[0].candidate;
    const stored = storedFrom(plain, { ncm: '94035000', ean: '7890000000017' });

    products.listProducts.mockResolvedValue([stored]);

    const withoutBase = await importFiles(reportFile(PRICE_REPORT));

    expect(withoutBase.conflicts.get(withoutBase.records[0].recordId).code.kind).toBe(CONFLICT_KIND_CATALOG);

    references.findReferences.mockImplementation(async (codes) => baseLookup(codes));

    const withBase = await importFiles(reportFile(PRICE_REPORT));

    expect(withBase.conflicts.get(withBase.records[0].recordId).code.kind).toBe(CONFLICT_KIND_IDENTICAL);
    expect(withBase.conflictSummary.pending).toBe(0);
  });
});

describe('correcao do usuario sobre o registro completado', () => {
  it('corrige o nome mantendo o NCM e o codigo de barras completados', async () => {
    const { records } = await importFiles(reportFile(PRICE_REPORT));

    useImportStore.getState().correctRecord(records[0].recordId, 'displayName', 'GUARDA ROUPA CORRIGIDO');

    const { corrections } = useImportStore.getState();

    expect(candidateForRecord(records[0], corrections)).toEqual(
      expect.objectContaining({ displayName: 'GUARDA ROUPA CORRIGIDO', ncm: '94035000', ean: '7890000000017' }),
    );
  });

  it('faz a correcao do NCM valer sobre o valor completado, e desfazer volta ao da base', async () => {
    const { records } = await importFiles(reportFile(PRICE_REPORT));
    const { recordId } = records[0];

    useImportStore.getState().correctRecord(recordId, 'ncm', '94036000');

    expect(candidateForRecord(records[0], useImportStore.getState().corrections).ncm).toBe('94036000');
    expect(useImportStore.getState().report.entries.get(recordId).corrected).toBe(true);

    useImportStore.getState().revertRecord(recordId);

    expect(candidateForRecord(records[0], useImportStore.getState().corrections).ncm).toBe('94035000');
  });
});

describe('gravacao do lote completado', () => {
  it('grava o produto com o NCM completado e sem a marca', async () => {
    await importFiles(reportFile(PRICE_REPORT));
    await useImportStore.getState().writeBatch();

    const written = products.createProduct.mock.calls.map(([product]) => product);

    expect(written).toHaveLength(3);
    expect(written[0]).toEqual(expect.objectContaining({ systemCode: '01620', ncm: '94035000', ean: '7890000000017' }));
    expect(written[0]).not.toHaveProperty('enrichedFields');
    expect(written[2]).not.toHaveProperty('ncm');
    written.forEach((product) => expect(ProductSchema.safeParse(product).success).toBe(true));
  });
});

describe('Completar dados', () => {
  it('nao consulta a base: completa so com o que o arquivo traz', async () => {
    const stored = storedFrom({ systemCode: '01620', displayName: 'GUARDA ROUPA INVENTADO', priceInCentavos: 129990 });

    products.listProducts.mockResolvedValue([stored]);

    await useCompletionStore.getState().readFiles([reportFile(STOCK_REPORT, 'saldo.TXT')]);

    const { plan } = useCompletionStore.getState();

    expect(references.findReferences).not.toHaveBeenCalled();
    expect(plan.summary.gainedByField).toEqual(expect.objectContaining({ ncm: 0, ean: 0, category: 1 }));
  });
});
