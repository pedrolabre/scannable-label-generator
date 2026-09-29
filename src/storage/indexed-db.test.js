// @vitest-environment node

import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { LabelForgeDatabase } from './indexed-db.js';

/**
 * A estrutura do banco e a passagem da versao 1 para a 2, contra um IndexedDB
 * em memoria que segue a especificacao. Cada caso usa um banco com nome
 * proprio, apagado no fim.
 */

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
  it('abre na versao 2 com as cinco tabelas e os indices da versao 1 intactos', async () => {
    const database = track(new LabelForgeDatabase(uniqueName()));

    await database.open();

    expect(database.verno).toBe(2);
    expect(describeTables(database)).toEqual({
      products: ['id', 'systemCode', 'ean'],
      labelLayouts: ['id'],
      sheetLayouts: ['id'],
      printJobs: ['id', 'createdAt'],
      referenceEntries: ['comparableCode'],
    });
  });

  it('abre o banco da versao 1 na versao 2 com os mesmos produtos e a base vazia', async () => {
    const name = uniqueName();
    const legacy = new Dexie(name);

    legacy.version(1).stores({
      products: 'id, systemCode, ean',
      labelLayouts: 'id',
      sheetLayouts: 'id',
      printJobs: 'id, createdAt',
    });

    const products = [
      produto('11111111-1111-4111-8111-111111111111', '1620'),
      produto('22222222-2222-4222-8222-222222222222', '01620'),
    ];

    await legacy.products.bulkAdd(products);
    legacy.close();

    const database = track(new LabelForgeDatabase(name));

    await database.open();

    expect(database.verno).toBe(2);
    expect(await database.products.orderBy('id').toArray()).toEqual(products);
    expect(await database.products.where('systemCode').equals('01620').count()).toBe(1);
    expect(await database.referenceEntries.count()).toBe(0);
  });
});
