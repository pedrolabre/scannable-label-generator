// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { clampSheetIndex, labelsOnSheet, paginateLabels } from './sheetPagination.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('paginateLabels', () => {
  it('conta as folhas de uma tiragem que passa de uma folha', () => {
    // 20 + 30 + 7 = 57 etiquetas; 24 por folha: 24 + 24 + 9, tres folhas.
    const items = [
      { productId: A, copies: 20 },
      { productId: B, copies: 30 },
      { productId: C, copies: 7 },
    ];

    expect(paginateLabels(items, 24)).toEqual({ totalLabels: 57, totalSheets: 3 });
  });

  it('fecha numa folha quando a tiragem enche uma folha exata', () => {
    expect(paginateLabels([{ productId: A, copies: 24 }], 24)).toEqual({
      totalLabels: 24,
      totalSheets: 1,
    });
    expect(paginateLabels([{ productId: A, copies: 25 }], 24).totalSheets).toBe(2);
  });

  it('nao produz folha quando a folha nao comporta etiqueta nenhuma', () => {
    expect(paginateLabels([{ productId: A, copies: 5 }], 0)).toEqual({
      totalLabels: 5,
      totalSheets: 0,
    });
  });

  it('responde por conta a uma tiragem de centenas de milhares de etiquetas', () => {
    const items = Array.from({ length: 200 }, (_, index) => ({
      productId: `produto-${index}`,
      copies: 999,
    }));

    // 200 x 999 = 199.800 etiquetas; 199.800 / 3 = 66.600 folhas.
    expect(paginateLabels(items, 3)).toEqual({ totalLabels: 199800, totalSheets: 66600 });

    const last = labelsOnSheet(items, 3, 66599);

    expect(last).toHaveLength(3);
    expect(last[2]).toEqual({ cellIndex: 2, productId: 'produto-199', copyNumber: 999 });
  });
});

describe('labelsOnSheet', () => {
  const items = [
    { productId: A, copies: 2 },
    { productId: B, copies: 5 },
    { productId: C, copies: 1 },
  ];

  it('mantem as copias do mesmo produto juntas, na ordem da selecao', () => {
    expect(labelsOnSheet(items, 10, 0).map((slot) => slot.productId)).toEqual([
      A, A, B, B, B, B, B, C,
    ]);
  });

  it('continua na folha seguinte do ponto em que a anterior parou', () => {
    // 4 por folha: [A1 A2 B1 B2] [B3 B4 B5 C1]
    expect(labelsOnSheet(items, 4, 0)).toEqual([
      { cellIndex: 0, productId: A, copyNumber: 1 },
      { cellIndex: 1, productId: A, copyNumber: 2 },
      { cellIndex: 2, productId: B, copyNumber: 1 },
      { cellIndex: 3, productId: B, copyNumber: 2 },
    ]);
    expect(labelsOnSheet(items, 4, 1)).toEqual([
      { cellIndex: 0, productId: B, copyNumber: 3 },
      { cellIndex: 1, productId: B, copyNumber: 4 },
      { cellIndex: 2, productId: B, copyNumber: 5 },
      { cellIndex: 3, productId: C, copyNumber: 1 },
    ]);
  });

  it('deixa a ultima folha parcial', () => {
    // 3 por folha: [A A B] [B B B] [B C]
    expect(labelsOnSheet(items, 3, 2)).toEqual([
      { cellIndex: 0, productId: B, copyNumber: 5 },
      { cellIndex: 1, productId: C, copyNumber: 1 },
    ]);
  });

  it('devolve folha vazia fora do intervalo ou sem capacidade', () => {
    expect(labelsOnSheet(items, 4, 2)).toEqual([]);
    expect(labelsOnSheet(items, 0, 0)).toEqual([]);
    expect(labelsOnSheet(items, 4, -1)).toEqual([]);
  });
});

describe('clampSheetIndex', () => {
  it('traz a folha escolhida para dentro do novo total', () => {
    expect(clampSheetIndex(4, 3)).toBe(2);
    expect(clampSheetIndex(1, 3)).toBe(1);
    expect(clampSheetIndex(2, 0)).toBe(0);
    expect(clampSheetIndex(-1, 3)).toBe(0);
  });
});
