// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  LIST_PAGE_SIZE,
  clampListPage,
  countListPages,
  itemsOnListPage,
  listPageRange,
} from './listPage.js';

describe('countListPages', () => {
  it('conta as paginas pelo tamanho fixo, com a ultima incompleta', () => {
    expect(LIST_PAGE_SIZE).toBe(50);
    expect(countListPages(0)).toBe(0);
    expect(countListPages(1)).toBe(1);
    expect(countListPages(50)).toBe(1);
    expect(countListPages(51)).toBe(2);
    expect(countListPages(19_000)).toBe(380);
  });

  it('nao produz pagina sem total valido', () => {
    expect(countListPages(-3)).toBe(0);
    expect(countListPages(Number.NaN)).toBe(0);
    expect(countListPages(10, 0)).toBe(0);
  });
});

describe('clampListPage', () => {
  it('traz a pagina para dentro do intervalo que existe', () => {
    expect(clampListPage(0, 3)).toBe(0);
    expect(clampListPage(2, 3)).toBe(2);
    expect(clampListPage(5, 3)).toBe(2);
    expect(clampListPage(-1, 3)).toBe(0);
    expect(clampListPage(4, 0)).toBe(0);
    expect(clampListPage(1.5, 3)).toBe(0);
  });
});

describe('itemsOnListPage', () => {
  const items = Array.from({ length: 120 }, (_, index) => index);

  it('corta a pagina na ordem recebida', () => {
    expect(itemsOnListPage(items, 0)).toEqual(items.slice(0, 50));
    expect(itemsOnListPage(items, 1)).toEqual(items.slice(50, 100));
    expect(itemsOnListPage(items, 2)).toEqual(items.slice(100));
  });

  it('nao devolve nada fora do intervalo nem sem lista', () => {
    expect(itemsOnListPage(items, 3)).toEqual([]);
    expect(itemsOnListPage(items, -1)).toEqual([]);
    expect(itemsOnListPage(null, 0)).toEqual([]);
  });
});

describe('listPageRange', () => {
  it('diz o trecho do resultado que esta na pagina, contado a partir de 1', () => {
    expect(listPageRange(120, 0)).toEqual({ first: 1, last: 50 });
    expect(listPageRange(120, 1)).toEqual({ first: 51, last: 100 });
    expect(listPageRange(120, 2)).toEqual({ first: 101, last: 120 });
    expect(listPageRange(0, 0)).toEqual({ first: 0, last: 0 });
  });
});
