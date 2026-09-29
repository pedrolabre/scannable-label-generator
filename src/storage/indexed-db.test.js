// @vitest-environment node

import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { BACKUP_DATABASE_VERSION } from '../domain/schemas/backupFileSchema.js';

import { LabelForgeDatabase } from './indexed-db.js';

/**
 * A estrutura do banco e a passagem das versoes 1 e 2 para a 3, contra um
 * IndexedDB em memoria que segue a especificacao. Cada caso usa um banco com
 * nome proprio, apagado no fim. Os bancos antigos sao montados com o Dexie puro
 * e o esquema que cada versao tinha.
 */

const ESQUEMA_V1 = {
  products: 'id, systemCode, ean',
  labelLayouts: 'id',
  sheetLayouts: 'id',
  printJobs: 'id, createdAt',
};

const ESQUEMA_V2 = { ...ESQUEMA_V1, referenceEntries: 'comparableCode' };

const opened = [];
let counter = 0;

function uniqueName() {
  counter += 1;

  return `banco-inventado-${counter}`;
}

function track(database) {
  opened.push(database);

  return database;
}

function describeTables(database) {
  return Object.fromEntries(
    database.tables.map((table) => [
      table.name,
      [table.schema.primKey.keyPath, ...table.schema.indexes.map((index) => index.keyPath)],
    ]),
  );
}

function storeNames(database) {
  return Array.from(database.backendDB().objectStoreNames).sort();
}

const CARGA = '2026-09-30T12:00:00.000Z';

function produto(id, systemCode) {
  return {
    id,
    systemCode,
    displayName: 'Rack inventado',
    priceInCentavos: 49990,
    createdAt: '2026-09-23T12:00:00.000Z',
    updatedAt: '2026-09-23T12:00:00.000Z',
  };
}

afterEach(async () => {
  while (opened.length > 0) {
    const database = opened.pop();

    database.close();
    await Dexie.delete(database.name);
  }
});

describe('LabelForgeDatabase', () => {
  it('abre na versao 3 so com produtos e base, com os indices intactos', async () => {
    const database = track(new LabelForgeDatabase(uniqueName()));

    await database.open();

    expect(database.verno).toBe(3);
    expect(describeTables(database)).toEqual({
      products: ['id', 'systemCode', 'ean'],
      referenceEntries: ['comparableCode'],
    });
    expect(storeNames(database)).toEqual(['products', 'referenceEntries']);
  });

  it('registra no backup a mesma versao do banco', async () => {
    const database = track(new LabelForgeDatabase(uniqueName()));

    await database.open();

    expect(BACKUP_DATABASE_VERSION).toBe(database.verno);
  });

  it('abre o banco da versao 1 na versao 3 com os mesmos produtos e a base vazia', async () => {
    const name = uniqueName();
    const legacy = new Dexie(name);

    legacy.version(1).stores(ESQUEMA_V1);

    const products = [
      produto('11111111-1111-4111-8111-111111111111', '1620'),
      produto('22222222-2222-4222-8222-222222222222', '01620'),
    ];

    await legacy.products.bulkAdd(products);
    legacy.close();

    const database = track(new LabelForgeDatabase(name));

    await database.open();

    expect(database.verno).toBe(3);
    expect(await database.products.orderBy('id').toArray()).toEqual(products);
    expect(await database.products.where('systemCode').equals('01620').count()).toBe(1);
    expect(await database.referenceEntries.count()).toBe(0);
    expect(storeNames(database)).toEqual(['products', 'referenceEntries']);
  });

  it('abre o banco da versao 2 na versao 3 com os mesmos produtos e a mesma base', async () => {
    const name = uniqueName();
    const legacy = new Dexie(name);

    legacy.version(1).stores(ESQUEMA_V1);
    legacy.version(2).stores(ESQUEMA_V2);

    const products = [
      { ...produto('11111111-1111-4111-8111-111111111111', '1620'), ean: '7890000000017' },
      produto('22222222-2222-4222-8222-222222222222', 'MESA-90'),
    ];
    const entries = [
      { comparableCode: '1620', systemCode: '1620', ncm: '94036000', loadedAt: CARGA },
      { comparableCode: '118114', systemCode: '118114', ean: '7890000000024', loadedAt: CARGA },
    ];

    await legacy.products.bulkAdd(products);
    await legacy.referenceEntries.bulkAdd(entries);
    legacy.close();

    const database = track(new LabelForgeDatabase(name));

    await database.open();

    expect(database.verno).toBe(3);
    expect(await database.products.orderBy('id').toArray()).toEqual(products);
    expect(await database.products.where('systemCode').equals('MESA-90').count()).toBe(1);
    expect(await database.products.where('ean').equals('7890000000017').count()).toBe(1);
    expect(await database.referenceEntries.orderBy('comparableCode').toArray()).toEqual([
      entries[1],
      entries[0],
    ]);
    expect(storeNames(database)).toEqual(['products', 'referenceEntries']);
  });
});
