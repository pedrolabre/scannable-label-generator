// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  describeCapacity,
  describeGridShape,
  describeSheetCount,
  describeSheetMargins,
  resolveSheetSlots,
  sheetSymbolTexts,
} from './sheetSlots.js';

const ARMARIO = {
  id: '11111111-1111-4111-8111-111111111111',
  systemCode: 'MOV-00412',
  displayName: 'ARMARIO',
  priceInCentavos: 89990,
};
const GELADEIRA = {
  id: '22222222-2222-4222-8222-222222222222',
  systemCode: 'ELE-00713',
  displayName: 'GELADEIRA',
  priceInCentavos: 329900,
};

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
      {
        cell: GRID.cells[0],
        product: ARMARIO,
        copyNumber: 1,
        symbolText: 'LF1|MOV-00412|ARMARIO|89990|||c1',
        symbolError: null,
      },
      {
        cell: GRID.cells[1],
        product: GELADEIRA,
        copyNumber: 1,
        symbolText: 'LF1|ELE-00713|GELADEIRA|329900|||c1',
        symbolError: null,
      },
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

describe('sheetSymbolTexts', () => {
  it('pede um simbolo por exemplar, e nao por codigo', () => {
    const slots = resolveSheetSlots(
      [
        { cellIndex: 0, productId: ARMARIO.id, copyNumber: 1 },
        { cellIndex: 1, productId: ARMARIO.id, copyNumber: 2 },
      ],
      [ARMARIO],
      GRID,
    );

    expect(sheetSymbolTexts(slots)).toEqual([
      'LF1|MOV-00412|ARMARIO|89990|||c1',
      'LF1|MOV-00412|ARMARIO|89990|||c2',
    ]);
  });

  it('entrega a recusa pronta quando o texto do exemplar nao vale', () => {
    const slots = resolveSheetSlots(
      [{ cellIndex: 0, productId: ARMARIO.id, copyNumber: 1 }],
      [{ ...ARMARIO, displayName: 'A|B' }],
      GRID,
    );

    expect(slots[0].symbolText).toBeNull();
    expect(slots[0].symbolError).toMatchObject({ name: 'BarcodeError' });
    expect(sheetSymbolTexts(slots)).toEqual([]);
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

describe('ficha da folha', () => {
  it('le a grade como colunas por linhas', () => {
    expect(describeGridShape({ columns: 3, rows: 8 })).toBe('3 × 8');
  });

  it('diz a margem uma vez quando as quatro sao iguais', () => {
    const sheet = { marginTopMm: 10, marginRightMm: 10, marginBottomMm: 10, marginLeftMm: 10 };

    expect(describeSheetMargins(sheet)).toBe('10 mm');
  });

  it('lista as quatro a partir do topo quando diferem, com virgula decimal', () => {
    const sheet = { marginTopMm: 8, marginRightMm: 10, marginBottomMm: 8, marginLeftMm: 12.5 };

    expect(describeSheetMargins(sheet)).toBe('8 · 10 · 8 · 12,5 mm');
  });
});
