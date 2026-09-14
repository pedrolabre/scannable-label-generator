import { beforeEach, describe, expect, it } from 'vitest';

import { generateSymbol } from './barcode.js';
import {
  BARCODE_CACHE_MAX_ENTRIES,
  barcodeCacheSize,
  clearBarcodeCache,
  readCachedSymbol,
  writeCachedSymbol,
} from './barcodeCache.js';

beforeEach(() => {
  clearBarcodeCache();
});

describe('geracao repetida do mesmo codigo', () => {
  it('gera uma vez so e devolve o mesmo objeto nas chamadas seguintes', async () => {
    const first = await generateSymbol('0012345');

    expect(barcodeCacheSize()).toBe(1);

    const second = await generateSymbol('0012345');
    const third = await generateSymbol('0012345');

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(barcodeCacheSize()).toBe(1);
  });

  it('atende uma folha inteira do mesmo produto com uma geracao', async () => {
    const sheet = Array.from({ length: 200 }, () => '0012345');
    const symbols = [];

    for (const code of sheet) {
      symbols.push(await generateSymbol(code));
    }

    expect(barcodeCacheSize()).toBe(1);
    expect(symbols.every((symbol) => symbol === symbols[0])).toBe(true);
  });

  it('guarda uma entrada por codigo distinto', async () => {
    await generateSymbol('0012345');
    await generateSymbol('0012346');
    await generateSymbol('ABC-123');

    expect(barcodeCacheSize()).toBe(3);
  });
});

describe('descarte do cache', () => {
  it('gera de novo depois do descarte, e chega ao mesmo desenho', async () => {
    const before = await generateSymbol('0012345');

    clearBarcodeCache();
    expect(barcodeCacheSize()).toBe(0);

    const after = await generateSymbol('0012345');

    expect(after).not.toBe(before);
    expect(after.svg).toBe(before.svg);
    expect(after.moduleCount).toBe(before.moduleCount);
    expect(barcodeCacheSize()).toBe(1);
  });

  it('respeita o teto de entradas descartando a mais antiga', () => {
    for (let index = 0; index < BARCODE_CACHE_MAX_ENTRIES; index += 1) {
      writeCachedSymbol(`chave-${index}`, { systemCode: String(index) });
    }

    expect(barcodeCacheSize()).toBe(BARCODE_CACHE_MAX_ENTRIES);
    expect(readCachedSymbol('chave-0')).toBeDefined();

    writeCachedSymbol('chave-extra', { systemCode: 'extra' });

    expect(barcodeCacheSize()).toBe(BARCODE_CACHE_MAX_ENTRIES);
    expect(readCachedSymbol('chave-0')).toBeUndefined();
    expect(readCachedSymbol('chave-extra')).toBeDefined();
  });
});
