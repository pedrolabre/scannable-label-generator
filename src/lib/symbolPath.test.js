// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { generateSymbol } from './barcode.js';
import { SymbolPathError, readSymbolPath, scaleSymbolPath } from './symbolPath.js';

/**
 * O contorno do simbolo e lido do desenho real do gerador, e nao de um SVG
 * escrito a mao: o que importa provar e que o formato que chega ao papel e o
 * formato que o motor produz hoje.
 */

const SQUARE_WITH_HOLE =
  '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">' +
  '<rect width="100%" height="100%" fill="#FFFFFF" />' +
  '<path d="M0 0L8 0L8 8L0 8ZM2 2L2 6L6 6L6 2Z" />' +
  '</svg>';

describe('leitura do caminho', () => {
  it('devolve um subcaminho por contorno, na ordem original', () => {
    const path = readSymbolPath(SQUARE_WITH_HOLE);

    expect(path.sideUnits).toBe(10);
    expect(path.subpaths).toHaveLength(2);
    expect(path.subpaths[0]).toEqual([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 8 },
      { x: 0, y: 8 },
    ]);
  });

  it('preserva o sentido contrario do buraco', () => {
    const [outer, hole] = readSymbolPath(SQUARE_WITH_HOLE).subpaths;

    // Area orientada: sinais opostos significam sentidos opostos, e e disso
    // que a regra de preenchimento nao nula depende para vazar o buraco.
    expect(Math.sign(signedArea(outer))).toBe(-Math.sign(signedArea(hole)));
  });

  it('recusa desenho sem caminho', () => {
    expect(() => readSymbolPath('<svg viewBox="0 0 10 10"></svg>')).toThrow(SymbolPathError);
  });

  it('recusa caixa que nao e quadrada', () => {
    expect(() => readSymbolPath('<svg viewBox="0 0 10 20"><path d="M0 0L1 0L1 1Z" /></svg>')).toThrow(
      SymbolPathError,
    );
  });
});

describe('caminho do simbolo gerado', () => {
  it('le o desenho do motor e o coloca na caixa do modelo, sem esticar', async () => {
    const symbol = await generateSymbol('MOV-00412');
    const path = readSymbolPath(symbol.svg);

    expect(path.sideUnits).toBe(58);
    expect(path.subpaths.length).toBeGreaterThan(1);

    const scaled = scaleSymbolPath(path, { xMm: 10, yMm: 20, sizeMm: 29 });
    const xs = scaled.flat().map((point) => point.xMm);
    const ys = scaled.flat().map((point) => point.yMm);

    // Fator de 29 mm por 58 unidades: meio milimetro por unidade nos dois eixos.
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(Math.max(...ys) - Math.min(...ys), 6);
    expect(Math.min(...xs)).toBeCloseTo(10 + 4 * 2 * 0.5, 6);
    expect(Math.min(...ys)).toBeCloseTo(20 + 4 * 2 * 0.5, 6);
  });
});

function signedArea(points) {
  return points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];

    return total + (point.x * next.y - next.x * point.y);
  }, 0);
}
