// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  describeCapacity,
  describeSheetCount,
  distinctSystemCodes,
  resolveSheetSlots,
} from './sheetSlots.js';

const ARMARIO = { id: '11111111-1111-4111-8111-111111111111', systemCode: 'MOV-00412' };
const GELADEIRA = { id: '22222222-2222-4222-8222-222222222222', systemCode: 'ELE-00713' };

const GRID = {
  perSheet: 2,
  cells: [
    { index: 0, xMm: 10, yMm: 10 },
    { index: 1, xMm: 63, yMm: 10 },
  ],
};

describe('resolveSheetSlots', () => {
  it('liga cada etiqueta ao produto atual e a posicao da grade', () => {
    const slots = resolveSheetSlots(
      [
        { cellIndex: 0, productId: ARMARIO.id, copyNumber: 1 },
        { cellIndex: 1, productId: GELADEIRA.id, copyNumber: 1 },
      ],
      [ARMARIO, GELADEIRA],
      GRID,
    );

    expect(slots).toEqual([
      { cell: GRID.cells[0], product: ARMARIO, copyNumber: 1 },
      { cell: GRID.cells[1], product: GELADEIRA, copyNumber: 1 },
    ]);
  });

  it('larga a etiqueta cujo produto saiu da lista', () => {
    const slots = resolveSheetSlots(
      [{ cellIndex: 0, productId: GELADEIRA.id, copyNumber: 1 }],
      [ARMARIO],
      GRID,
    );

    expect(slots).toEqual([]);
  });
});

describe('distinctSystemCodes', () => {
  it('pede um simbolo por codigo, e nao por copia', () => {
    const slots = [
      { product: ARMARIO },
      { product: ARMARIO },
      { product: GELADEIRA },
      { product: ARMARIO },
    ];

    expect(distinctSystemCodes(slots)).toEqual(['MOV-00412', 'ELE-00713']);
  });
});

describe('avisos de quantidade', () => {
  it('avisa quando a selecao passa de uma folha', () => {
    expect(describeSheetCount({ totalLabels: 57, totalSheets: 3 }, 24)).toBe(
      'A seleção ocupa 3 folhas: 57 etiquetas, 24 por folha.',
    );
    expect(describeSheetCount({ totalLabels: 24, totalSheets: 1 }, 24)).toBeNull();
  });

  it('descreve a capacidade quando cabe numa folha', () => {
    expect(describeCapacity({ totalLabels: 1 }, 3)).toBe(
      '1 etiqueta numa folha que comporta 3 etiquetas.',
    );
    expect(describeCapacity({ totalLabels: 1 }, 1)).toBe(
      '1 etiqueta numa folha que comporta 1 etiqueta.',
    );
  });
});
