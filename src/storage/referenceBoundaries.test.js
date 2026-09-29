// @vitest-environment node

import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  BACKUP_DATABASE_VERSION,
  BACKUP_FORMAT_VERSION,
} from '../domain/schemas/backupFileSchema.js';
import { readBackupFile } from '../domain/services/backupRead.js';
import { buildBackupFile, serializeBackupFile } from '../domain/services/backupFile.js';

import { readBackupTables, writeBackupTables } from './backupRepository.js';
import { db } from './indexed-db.js';
import { clearAllProducts, createProduct, listProducts } from './productRepository.js';
import { getReferenceStats, replaceReferenceEntries } from './referenceRepository.js';

/**
 * A base de referencia e separada do catalogo: a carga nao escreve em produto
 * nenhum, zerar o catalogo nao apaga a base, e o backup nem a le nem a apaga.
 * Tudo contra o IndexedDB em memoria, com os repositorios de verdade.
 */

const LOADED_AT = '2026-09-30T12:00:00.000Z';

const WARDROBE = Object.freeze({
  id: '11111111-1111-4111-8111-111111111111',
  systemCode: '01620',
  displayName: 'GUARDA ROUPA INVENTADO',
  priceInCentavos: 129990,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
});

const ENTRIES = [
  { comparableCode: '1620', systemCode: '1620', ncm: '94035000', ean: '7890000000017' },
  { comparableCode: '118114', systemCode: '118114', ncm: '73211100' },
];

const BASE_STATS = { total: 2, withNcm: 2, withEan: 1, loadedAt: LOADED_AT };

// Arquivo no formato 1, como todo backup gerado antes da versao 3 do banco.
function backupText(products) {
  return JSON.stringify({
    format: 'labelforge-backup',
    formatVersion: 1,
    databaseVersion: 1,
    generatedAt: '2026-09-20T12:00:00.000Z',
    counts: { products: products.length, labelLayouts: 0, sheetLayouts: 0, printJobs: 0 },
    tables: { products, labelLayouts: [], sheetLayouts: [], printJobs: [] },
  });
}

beforeEach(async () => {
  await db.products.clear();
  await db.referenceEntries.clear();
});

describe('carga da base e catalogo', () => {
  it('nao escreve na tabela de produtos', async () => {
    await createProduct(WARDROBE);
    await replaceReferenceEntries(ENTRIES, { loadedAt: LOADED_AT });

    expect(await listProducts()).toEqual([WARDROBE]);
  });

  it('zerar o catalogo mantem a base', async () => {
    await createProduct(WARDROBE);
    await replaceReferenceEntries(ENTRIES, { loadedAt: LOADED_AT });
    await clearAllProducts();

    expect(await listProducts()).toEqual([]);
    expect(await getReferenceStats()).toEqual(BASE_STATS);
  });
});

describe('base e backup', () => {
  it('o arquivo gerado leva so os produtos e nao leva a base', async () => {
    await createProduct(WARDROBE);
    await replaceReferenceEntries(ENTRIES, { loadedAt: LOADED_AT });

    const tables = await readBackupTables();
    const file = buildBackupFile(tables, new Date(LOADED_AT));

    expect(Object.keys(tables)).toEqual(['products']);
    expect(file.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(file.databaseVersion).toBe(BACKUP_DATABASE_VERSION);
    expect(serializeBackupFile(file)).not.toContain('94035000');
    expect(readBackupFile(serializeBackupFile(file)).issues).toEqual([]);
  });

  it('gerar e restaurar devolve os mesmos produtos e mantem a base', async () => {
    await createProduct(WARDROBE);
    await replaceReferenceEntries(ENTRIES, { loadedAt: LOADED_AT });

    const text = serializeBackupFile(buildBackupFile(await readBackupTables(), new Date(LOADED_AT)));

    await clearAllProducts();

    const read = readBackupFile(text);

    expect(read.issues).toEqual([]);

    await writeBackupTables(read.file.tables);

    expect(await listProducts()).toEqual([WARDROBE]);
    expect(await getReferenceStats()).toEqual(BASE_STATS);
  });

  it('aceita o backup ja gerado na versao 1 e restaura sem tocar na base', async () => {
    await replaceReferenceEntries(ENTRIES, { loadedAt: LOADED_AT });

    const read = readBackupFile(backupText([WARDROBE]));

    expect(read.issues).toEqual([]);

    await writeBackupTables(read.file.tables);

    expect(await listProducts()).toEqual([WARDROBE]);
    expect(await getReferenceStats()).toEqual(BASE_STATS);
  });
});
