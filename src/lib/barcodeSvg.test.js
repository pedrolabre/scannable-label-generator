import { describe, expect, it } from 'vitest';

import { isSquareSvg, normalizeSymbolSvg, readSvgViewBox } from './barcodeSvg.js';

const SQUARE = '<svg viewBox="0 0 58 58" xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>';

describe('leitura da caixa do simbolo', () => {
  it('devolve os quatro numeros do viewBox', () => {
    expect(readSvgViewBox(SQUARE)).toEqual({ minX: 0, minY: 0, width: 58, height: 58 });
  });

  it('reconhece caixa quadrada e caixa deformada', () => {
    expect(isSquareSvg(SQUARE)).toBe(true);
    expect(isSquareSvg('<svg viewBox="0 0 64 16"></svg>')).toBe(false);
  });

  it('recusa desenho sem raiz e sem viewBox', () => {
    expect(() => readSvgViewBox('nao e svg')).toThrowError(/elemento raiz/);
    expect(() => readSvgViewBox('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toThrowError(
      /viewBox/,
    );
  });
});

describe('ajuste do desenho para o layout', () => {
  it('acrescenta a garantia de proporcao ao elemento raiz', () => {
    const normalized = normalizeSymbolSvg(SQUARE);

    expect(normalized).toMatch(/preserveAspectRatio="xMidYMid meet"/);
    expect(normalized).toMatch(/shape-rendering="crispEdges"/);
    expect(readSvgViewBox(normalized)).toEqual(readSvgViewBox(SQUARE));
  });

  it('recusa desenho que ja venha com dimensao fixa', () => {
    expect(() => normalizeSymbolSvg('<svg width="58" viewBox="0 0 58 58"></svg>')).toThrowError(
      /largura ou altura fixa/,
    );
    expect(() => normalizeSymbolSvg('<svg height="58" viewBox="0 0 58 58"></svg>')).toThrowError(
      /largura ou altura fixa/,
    );
  });
});
