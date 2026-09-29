// @vitest-environment node

import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from './indexed-db.js';
import {
  clearReferenceEntries,
  findReference,
  findReferences,
  getReferenceStats,
  replaceReferenceEntries,
} from './referenceRepository.js';

/**
 * A base de referencia contra um IndexedDB em memoria que segue a
 * especificacao, com o Dexie de verdade por cima: a transacao que desfaz a
 * carga, a chave pelo codigo comparavel e a busca em lista.
 */

const FIRST_LOAD = '2026-09-29T12:00:00.000Z';
const SECOND_LOAD = '2026-09-30T12:00:00.000Z';

const WARDROBE = { comparableCode: '1620', systemCode: '1620', ncm: '94035000', ean: '7890000000017' };
const STOVE = { comparableCode: '118114', systemCode: '118114', ncm: '73211100' };
const BED = { comparableCode: '5001', systemCode: '05001', ean: '7890000000024' };

beforeEach(async () => {
  await db.referenceEntries.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('replaceReferenceEntries', () => {
  it('grava a carga numa transacao so e devolve quantas linhas entraram', async () => {
    const transaction = vi.spyOn(db, 'transaction');

    await expect(replaceReferenceEntries([WARDROBE, STOVE], { loadedAt: FIRST_LOAD })).resolves.toBe(2);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(await db.referenceEntries.get('1620')).toEqual({ ...WARDROBE, loadedAt: FIRST_LOAD });
  });

  it('substitui a base inteira: codigo ausente da carga nova sai', async () => {
    await replaceReferenceEntries([WARDROBE, STOVE], { loadedAt: FIRST_LOAD });
    await replaceReferenceEntries([BED], { loadedAt: SECOND_LOAD });

    expect(await db.referenceEntries.toArray()).toEqual([{ ...BED, loadedAt: SECOND_LOAD }]);
  });

  it('deixa a base como estava quando a transacao falha no meio', async () => {
    await replaceReferenceEntries([WARDROBE, STOVE], { loadedAt: FIRST_LOAD });

    // Duas linhas com a mesma chave: a limpeza ja aconteceu quando a segunda
    // gravacao falha, e a transacao desfaz as duas pontas.
    await expect(
      replaceReferenceEntries([BED, { ...BED, systemCode: '5001' }], { loadedAt: SECOND_LOAD }),
    ).rejects.toThrow();

    expect(await db.referenceEntries.orderBy('comparableCode').toArray()).toEqual([
      { ...STOVE, loadedAt: FIRST_LOAD },
      { ...WARDROBE, loadedAt: FIRST_LOAD },
    ]);
  });

  it('recusa a carga inteira antes da transacao quando uma linha esta fora do contrato', async () => {
    await replaceReferenceEntries([WARDROBE], { loadedAt: FIRST_LOAD });

    const transaction = vi.spyOn(db, 'transaction');

    await expect(
      replaceReferenceEntries([STOVE, { comparableCode: '7001', systemCode: '7001', ncm: '9401610' }]),
    ).rejects.toThrow();
    await expect(replaceReferenceEntries([{ comparableCode: '7002', systemCode: '7002' }])).rejects.toThrow();

    expect(transaction).not.toHaveBeenCalled();
    expect(await db.referenceEntries.count()).toBe(1);
  });
});

describe('findReference e findReferences', () => {
  beforeEach(async () => {
    await replaceReferenceEntries([WARDROBE, STOVE, BED], { loadedAt: FIRST_LOAD });
  });

  it('acha um codigo com e sem zeros a esquerda', async () => {
    expect(await findReference('1620')).toEqual({ systemCode: '1620', ncm: '94035000', ean: '7890000000017' });
    expect(await findReference('001620')).toEqual({ systemCode: '1620', ncm: '94035000', ean: '7890000000017' });
    expect(await findReference('5001')).toEqual({ systemCode: '05001', ean: '7890000000024' });
  });

  it('devolve null para o codigo ausente e para o codigo vazio', async () => {
    expect(await findReference('999999')).toBeNull();
    expect(await findReference('')).toBeNull();
  });

  it('acha uma lista numa leitura so, com o codigo como foi pedido, e deixa o ausente fora', async () => {
    const bulkGet = vi.spyOn(db.referenceEntries, 'bulkGet');

    const found = await findReferences(['01620', '118114', '999999', '05001', '01620']);

    expect(bulkGet).toHaveBeenCalledTimes(1);
    expect([...found.keys()]).toEqual(['01620', '118114', '05001']);
    expect(found.get('01620')).toEqual({ systemCode: '1620', ncm: '94035000', ean: '7890000000017' });
    expect(found.get('118114')).toEqual({ systemCode: '118114', ncm: '73211100' });
    expect(found.has('999999')).toBe(false);
  });
});

describe('getReferenceStats e clearReferenceEntries', () => {
  it('conta as linhas, as com NCM, as com codigo de barras e guarda a data da carga', async () => {
    expect(await getReferenceStats()).toEqual({ total: 0, withNcm: 0, withEan: 0, loadedAt: null });

    await replaceReferenceEntries([WARDROBE, STOVE, BED], { loadedAt: SECOND_LOAD });

    expect(await getReferenceStats()).toEqual({ total: 3, withNcm: 2, withEan: 2, loadedAt: SECOND_LOAD });
  });

  it('apaga a base inteira', async () => {
    await replaceReferenceEntries([WARDROBE, STOVE], { loadedAt: FIRST_LOAD });
    await clearReferenceEntries();

    expect(await getReferenceStats()).toEqual({ total: 0, withNcm: 0, withEan: 0, loadedAt: null });
  });
});

describe('desempenho no IndexedDB em memoria', () => {
  const entries = Array.from({ length: 20000 }, (_, i) => ({
    comparableCode: String(100000 + i),
    systemCode: String(100000 + i),
    ncm: '94035000',
    ...(i % 7 === 0 ? { ean: String(7890000000000 + i) } : {}),
  }));

  it('grava 20.000 linhas e acha as 20.000 numa busca em lista em menos de 5 s cada', async () => {
    let started = performance.now();

    await replaceReferenceEntries(entries, { loadedAt: FIRST_LOAD });

    const loadElapsed = performance.now() - started;

    started = performance.now();

    const found = await findReferences(entries.map((entry) => `0${entry.systemCode}`));
    const findElapsed = performance.now() - started;

    expect(found.size).toBe(20000);
    expect(loadElapsed).toBeLessThan(5000);
    expect(findElapsed).toBeLessThan(5000);
  }, 60_000);

  it('acha um codigo em menos de 1 ms em media', async () => {
    await replaceReferenceEntries(entries, { loadedAt: FIRST_LOAD });

    const started = performance.now();

    for (let i = 0; i < 1000; i += 1) {
      await findReference(String(100000 + i * 20));
    }

    expect((performance.now() - started) / 1000).toBeLessThan(1);
  }, 60_000);
});
