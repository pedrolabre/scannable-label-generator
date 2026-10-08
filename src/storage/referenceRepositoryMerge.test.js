// @vitest-environment node

import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from './indexed-db.js';
import {
  getReferenceStats,
  mergeReferenceEntries,
  previewReferenceLoad,
  replaceReferenceBase,
  replaceReferenceEntries,
} from './referenceRepository.js';

/**
 * As duas cargas da base contra um IndexedDB em memoria, com o Dexie de
 * verdade: atualizar codigo por codigo sem apagar nada, trocar a base inteira
 * contando o que saiu, e a previa que nao grava.
 */

const FIRST_LOAD = '2026-09-29T12:00:00.000Z';
const SECOND_LOAD = '2026-10-08T12:00:00.000Z';

const WARDROBE = { comparableCode: '1620', systemCode: '1620', ncm: '94035000', ean: '7890000000017' };
const STOVE = { comparableCode: '118114', systemCode: '118114', ncm: '73211100' };
const BED = { comparableCode: '5001', systemCode: '05001', ean: '7890000000024' };

beforeEach(async () => {
  await db.referenceEntries.clear();
  await replaceReferenceEntries([WARDROBE, STOVE], { loadedAt: FIRST_LOAD });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mergeReferenceEntries', () => {
  it('soma o codigo novo, atualiza o que mudou e nao apaga o ausente', async () => {
    const summary = await mergeReferenceEntries(
      [{ comparableCode: '1620', systemCode: '01620', ncm: '94036000' }, BED],
      { loadedAt: SECOND_LOAD },
    );

    expect(summary).toEqual({ added: 1, updated: 1, unchanged: 0 });
    expect(await db.referenceEntries.get('1620')).toEqual({
      comparableCode: '1620',
      systemCode: '01620',
      ncm: '94036000',
      ean: '7890000000017',
      loadedAt: SECOND_LOAD,
    });
    expect(await db.referenceEntries.get('118114')).toEqual({ ...STOVE, loadedAt: FIRST_LOAD });
    expect(await db.referenceEntries.get('5001')).toEqual({ ...BED, loadedAt: SECOND_LOAD });
    expect((await getReferenceStats()).total).toBe(3);
  });

  it('conta como igual o codigo sem mudanca e marca a data da carga', async () => {
    const summary = await mergeReferenceEntries([STOVE], { loadedAt: SECOND_LOAD });

    expect(summary).toEqual({ added: 0, updated: 0, unchanged: 1 });
    expect((await getReferenceStats()).loadedAt).toBe(SECOND_LOAD);
  });

  it('deixa a base como estava quando uma linha e recusada', async () => {
    await expect(
      mergeReferenceEntries([BED, { comparableCode: '9', systemCode: '9', ncm: '123' }], {
        loadedAt: SECOND_LOAD,
      }),
    ).rejects.toThrow();

    expect(await db.referenceEntries.count()).toBe(2);
    expect(await db.referenceEntries.get('5001')).toBeUndefined();
  });
});

describe('replaceReferenceBase', () => {
  it('troca a base inteira e diz quantos codigos sairam', async () => {
    const result = await replaceReferenceBase([STOVE, BED], { loadedAt: SECOND_LOAD });

    expect(result).toEqual({ entryCount: 2, removed: 1 });
    expect((await db.referenceEntries.toArray()).map((entry) => entry.comparableCode).sort()).toEqual([
      '118114',
      '5001',
    ]);
  });
});

describe('previewReferenceLoad', () => {
  it('diz o que cada carga faria, sem gravar', async () => {
    const preview = await previewReferenceLoad([
      { comparableCode: '1620', systemCode: '1620', ncm: '94036000' },
      BED,
    ]);

    expect(preview).toEqual({ added: 1, updated: 1, unchanged: 0, removedOnReplace: 1 });
    expect(await db.referenceEntries.count()).toBe(2);
    expect(await db.referenceEntries.get('1620')).toEqual({ ...WARDROBE, loadedAt: FIRST_LOAD });
  });
});
