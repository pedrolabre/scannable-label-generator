// @vitest-environment node

import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { HEADER_ROW, productRow, singleSheetOds } from '../domain/services/odsFixtures.js';
import { parseOdsFile } from '../domain/services/odsParser.js';
import { attachProductCandidate } from '../domain/services/productMapping.js';
import { buildReferenceEntries } from '../domain/services/referenceEntries.js';
import { bytesOf, footer, priceHeader, priceRow } from '../domain/services/txtReportFixtures.js';
import { db } from '../storage/indexed-db.js';
import { listProducts } from '../storage/productRepository.js';
import { replaceReferenceEntries } from '../storage/referenceRepository.js';

import { useImportStore } from './useImportStore.js';

/**
 * A importacao com a base de verdade, sobre um IndexedDB em memoria: a base e
 * carregada a partir da planilha cadastral como no Completar dados, e o lote
 * passa pela busca em lista, pela conferencia e pela gravacao reais.
 */

const SHEET_ROWS = [
  productRow({ code: 1620, description: 'GUARDA ROUPA INVENTADO 6 PORTAS', barcode: '7890000000017', ncm: '94035000' }),
  productRow({ code: 118114, description: 'FOGAO INVENTADO 4 BOCAS', ncm: '73211100' }),
];

const PRICE_REPORT = bytesOf([
  ...priceHeader(1),
  priceRow({ code: '01620', description: 'GUARDA ROUPA INVENTADO 6PTS', price: '1.299,90' }),
  priceRow({ code: '118114', description: 'FOGAO INVENTADO 4 BOCAS', price: '899,00' }),
  priceRow({ code: '777777', description: 'POLTRONA INVENTADA', price: '450,00' }),
  ...footer(3),
]);

async function loadBaseFromSheet() {
  const records = await parseOdsFile(await singleSheetOds([HEADER_ROW, ...SHEET_ROWS]), {
    fileName: 'cadastro-inventado.ods',
    fileIndex: 0,
  });

  await replaceReferenceEntries(buildReferenceEntries(records.map(attachProductCandidate)).entries);
}

async function importAndWrite() {
  await useImportStore.getState().parseFiles([new File([PRICE_REPORT], 'tabela-inventada.txt')]);
  await useImportStore.getState().writeBatch();

  const stored = await listProducts();

  return new Map(stored.map((product) => [product.systemCode, product]));
}

beforeEach(async () => {
  await db.products.clear();
  await db.referenceEntries.clear();
  useImportStore.getState().reset();
});

describe('importacao com a base no IndexedDB', () => {
  it('grava os produtos da Tabela com o NCM e o codigo de barras da base', async () => {
    await loadBaseFromSheet();

    const stored = await importAndWrite();
    const { enrichmentSummary, writeResult } = useImportStore.getState();

    expect(writeResult.created).toBe(3);
    expect(stored.get('01620')).toEqual(expect.objectContaining({ ncm: '94035000', ean: '7890000000017' }));
    expect(stored.get('118114')).toEqual(expect.objectContaining({ ncm: '73211100' }));
    expect(stored.get('118114')).not.toHaveProperty('ean');
    expect(stored.get('777777')).not.toHaveProperty('ncm');
    expect([...stored.values()].some((product) => 'enrichedFields' in product)).toBe(false);
    expect(enrichmentSummary).toEqual(expect.objectContaining({ found: 2, notFound: 1, enriched: 2 }));
  });

  it('reimporta a mesma Tabela sem conflito e sem apagar o NCM gravado', async () => {
    await loadBaseFromSheet();
    await importAndWrite();

    useImportStore.getState().reset();

    const stored = await importAndWrite();
    const { conflictSummary, writeResult } = useImportStore.getState();

    expect(conflictSummary.pending).toBe(0);
    expect(writeResult).toEqual(expect.objectContaining({ created: 0, replaced: 0, alreadyInCatalog: 3 }));
    expect(stored.get('01620')).toEqual(expect.objectContaining({ ncm: '94035000', ean: '7890000000017' }));
  });

  it('com a base vazia, grava os mesmos produtos de antes, sem NCM nem codigo de barras', async () => {
    const stored = await importAndWrite();

    expect(stored.size).toBe(3);
    expect([...stored.values()].some((product) => 'ncm' in product || 'ean' in product)).toBe(false);
    expect(useImportStore.getState().enrichmentSummary.found).toBe(0);
    expect(useImportStore.getState().referenceError).toBeNull();
  });

  it('nao muda a base ao importar', async () => {
    await loadBaseFromSheet();

    const before = await db.referenceEntries.toArray();

    await importAndWrite();

    expect(await db.referenceEntries.toArray()).toEqual(before);
  });
});
