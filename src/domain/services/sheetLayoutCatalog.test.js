// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { SheetLayoutSchema } from '../schemas/sheetLayoutSchema.js';

import {
  DEFAULT_SHEET_LAYOUT_ID,
  SHEET_LAYOUTS,
  findSheetLayout,
  getDefaultSheetLayout,
  listSheetLayouts,
} from './sheetLayoutCatalog.js';

describe('catalogo de folhas', () => {
  it('todo modelo passa pelo contrato da folha, com identificadores distintos', () => {
    for (const layout of SHEET_LAYOUTS) {
      expect(SheetLayoutSchema.safeParse(layout).success).toBe(true);
    }

    expect(new Set(SHEET_LAYOUTS.map((layout) => layout.id)).size).toBe(SHEET_LAYOUTS.length);
  });

  it('o padrao existe, e a folha de 10 etiquetas, e vem primeiro na lista', () => {
    expect(DEFAULT_SHEET_LAYOUT_ID).toBe('a4-10-etiquetas');
    expect(getDefaultSheetLayout().id).toBe('a4-10-etiquetas');
    expect(listSheetLayouts()).toBe(SHEET_LAYOUTS);
    expect(SHEET_LAYOUTS[0].id).toBe(DEFAULT_SHEET_LAYOUT_ID);
    expect(findSheetLayout('folha-que-nao-existe')).toBeNull();
  });

  it('a folha de 10 etiquetas repete a posicao da folha antiga', () => {
    expect(getDefaultSheetLayout()).toEqual({
      id: 'a4-10-etiquetas',
      name: 'A4 10 etiquetas (2 x 5)',
      widthMm: 210,
      heightMm: 297,
      marginTopMm: 12.7,
      marginRightMm: 12.7,
      marginBottomMm: 12.7,
      marginLeftMm: 12.7,
      columnGapMm: 13.9,
      rowGapMm: 6.5,
    });
  });

  it('mantem os dois modelos anteriores como estavam', () => {
    expect(findSheetLayout('a4-retrato')).toMatchObject({
      widthMm: 210,
      heightMm: 297,
      marginTopMm: 10,
      columnGapMm: 3,
      rowGapMm: 3,
    });
    expect(findSheetLayout('a4-paisagem')).toMatchObject({
      widthMm: 297,
      heightMm: 210,
      marginTopMm: 10,
      columnGapMm: 3,
      rowGapMm: 3,
    });
  });

  it('nao permite alteracao do catalogo em tempo de execucao', () => {
    expect(Object.isFrozen(SHEET_LAYOUTS)).toBe(true);
    expect(SHEET_LAYOUTS.every((layout) => Object.isFrozen(layout))).toBe(true);
  });
});
