// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  SHEET_FIELDS,
  describeCompactGain,
  parseMillimeters,
} from '../../components/print/printInputs.js';
import { usePrintJobStore } from '../../store/usePrintJobStore.js';
import { SheetLayoutSchema } from '../schemas/sheetLayoutSchema.js';

import { findLabelLayout } from './labelLayoutCatalog.js';
import { buildSheetLayout } from './printJobBuilder.js';
import { computeSheetGrid, describeEmptyGrid } from './sheetGrid.js';
import { findSheetLayout } from './sheetLayoutCatalog.js';

const RETRATO = findSheetLayout('a4-retrato');
const PAISAGEM = findSheetLayout('a4-paisagem');
const GRANDE = findLabelLayout('tag-grande');
const MEDIA = findLabelLayout('etiqueta-media');
const PEQUENA = findLabelLayout('etiqueta-pequena');
const DEZ = findSheetLayout('a4-10-etiquetas');
const MEDIA_DEZ = findLabelLayout('etiqueta-media-10');

function overlaps(a, b) {
  return (
    a.xMm < b.xMm + b.widthMm &&
    b.xMm < a.xMm + a.widthMm &&
    a.yMm < b.yMm + b.heightMm &&
    b.yMm < a.yMm + a.heightMm
  );
}

describe('folha de 10 etiquetas com a etiqueta de 10 por folha', () => {
  // Area util: 184,6 x 271,6 mm. Largura: 2 x 84,7 + 13,9 = 183,3; tres colunas
  // pediriam 281,9. Altura: 5 x 46,6 + 4 x 6,5 = 259; seis linhas pediriam 312,1.
  it('fecha duas colunas por cinco linhas, dentro da area util e sem sobreposicao', () => {
    const grid = computeSheetGrid(DEZ, MEDIA_DEZ);

    expect(grid.columns).toBe(2);
    expect(grid.rows).toBe(5);
    expect(grid.perSheet).toBe(10);
    expect(grid.cells).toHaveLength(10);

    const right = DEZ.widthMm - DEZ.marginRightMm;
    const bottom = DEZ.heightMm - DEZ.marginBottomMm;

    for (const cell of grid.cells) {
      expect(cell.xMm).toBeGreaterThanOrEqual(DEZ.marginLeftMm);
      expect(cell.yMm).toBeGreaterThanOrEqual(DEZ.marginTopMm);
      expect(cell.xMm + cell.widthMm).toBeLessThanOrEqual(right);
      expect(cell.yMm + cell.heightMm).toBeLessThanOrEqual(bottom);
    }

    grid.cells.forEach((cell, index) => {
      grid.cells.slice(index + 1).forEach((other) => {
        expect(overlaps(cell, other)).toBe(false);
      });
    });
  });

  it('poe cada etiqueta na posicao da folha antiga', () => {
    const { cells } = computeSheetGrid(DEZ, MEDIA_DEZ);

    // Segunda coluna: 12,7 + 84,7 + 13,9. Quinta linha: 12,7 + 4 x 53,1.
    expect(cells[1]).toMatchObject({ xMm: 111.3, yMm: 12.7 });
    expect(cells[9]).toMatchObject({ xMm: 111.3, yMm: 225.1 });
  });

  it('fecha a mesma grade com os numeros que voltam dos campos da tela', () => {
    usePrintJobStore.getState().resetPrintJob();

    const { sheetLayoutId, labelLayoutId, sheetAdjustments } = usePrintJobStore.getState();
    const adjustments = {};

    SHEET_FIELDS.forEach((field) => {
      const { value, error } = parseMillimeters(sheetAdjustments[field.key], field);

      expect(error).toBeNull();
      expect(value).toBe(DEZ[field.key]);
      adjustments[field.key] = value;
    });

    const { sheet } = buildSheetLayout(sheetLayoutId, adjustments);
    const grid = computeSheetGrid(sheet, findLabelLayout(labelLayoutId));

    expect(sheetLayoutId).toBe('a4-10-etiquetas');
    expect(labelLayoutId).toBe('etiqueta-media-10');
    expect(grid).toMatchObject({ columns: 2, rows: 5, perSheet: 10 });
  });

  it.each([
    // Largura 184,6: 1 x 100; 2 x 100 + 13,9 passa. Altura 271,6: 3 x 70 + 2 x 6,5
    // = 223; 4 x 70 + 3 x 6,5 = 299,5 passa.
    ['tag-grande', GRANDE, 1, 3, 3],
    // 2 x 70 + 13,9 = 153,9; 3 x 70 + 27,8 passa. 4 x 50 + 19,5 = 219,5;
    // 5 x 50 + 26 = 276 passa.
    ['etiqueta-media', MEDIA, 2, 4, 8],
    // 3 x 50 + 27,8 = 177,8; 4 x 50 + 41,7 passa. 7 x 30 + 39 = 249;
    // 8 x 30 + 45,5 = 285,5 passa.
    ['etiqueta-pequena', PEQUENA, 3, 7, 21],
  ])('%s na folha de 10', (_name, label, columns, rows, perSheet) => {
    expect(computeSheetGrid(DEZ, label)).toMatchObject({ columns, rows, perSheet });
  });

  it('o atalho que aproveita a folha abre uma linha a mais e continua sendo oferecido', () => {
    // Margem de 5 mm e etiquetas encostadas: 287 / 46,6 = 6 linhas.
    expect(describeCompactGain(DEZ, MEDIA_DEZ)).toEqual({
      layoutPerSheet: 10,
      compactPerSheet: 12,
      gains: true,
    });
  });
});

describe('oferta do atalho que aproveita a folha', () => {
  it.each([
    ['tag-grande', 'a4-retrato', GRANDE, 3, 8, true],
    ['etiqueta-media', 'a4-retrato', MEDIA, 10, 10, false],
    ['etiqueta-pequena', 'a4-retrato', PEQUENA, 24, 36, true],
  ])('%s em %s', (_name, sheetId, label, layoutPerSheet, compactPerSheet, gains) => {
    expect(describeCompactGain(findSheetLayout(sheetId), label)).toEqual({
      layoutPerSheet,
      compactPerSheet,
      gains,
    });
  });
});

describe('capacidade das duas folhas com as medidas do catalogo', () => {
  // Margem de 10 mm e espacamento de 3 mm. Area util do retrato: 190 x 277 mm;
  // da paisagem: 277 x 190 mm. Cabem n pecas quando n * lado + (n - 1) * 3 nao
  // passa da area util.
  it.each([
    // retrato, largura 190: 1 x 100 = 100; 2 x 100 + 3 = 203 passa
    // retrato, altura 277: 3 x 70 + 2 x 3 = 216; 4 x 70 + 3 x 3 = 289 passa
    ['tag-grande', 'a4-retrato', GRANDE, 1, 3, 3],
    // 2 x 70 + 3 = 143; 3 x 70 + 6 = 216 passa
    // 5 x 50 + 12 = 262; 6 x 50 + 15 = 315 passa
    ['etiqueta-media', 'a4-retrato', MEDIA, 2, 5, 10],
    // 3 x 50 + 6 = 156; 4 x 50 + 9 = 209 passa
    // 8 x 30 + 21 = 261; 9 x 30 + 24 = 294 passa
    ['etiqueta-pequena', 'a4-retrato', PEQUENA, 3, 8, 24],
    // paisagem, largura 277: 2 x 100 + 3 = 203; 3 x 100 + 6 = 306 passa
    // paisagem, altura 190: 2 x 70 + 3 = 143; 3 x 70 + 6 = 216 passa
    ['tag-grande', 'a4-paisagem', GRANDE, 2, 2, 4],
    // 3 x 70 + 6 = 216; 4 x 70 + 9 = 289 passa
    // 3 x 50 + 6 = 156; 4 x 50 + 9 = 209 passa
    ['etiqueta-media', 'a4-paisagem', MEDIA, 3, 3, 9],
    // 5 x 50 + 12 = 262; 6 x 50 + 15 = 315 passa
    // 5 x 30 + 12 = 162; 6 x 30 + 15 = 195 passa
    ['etiqueta-pequena', 'a4-paisagem', PEQUENA, 5, 5, 25],
  ])('%s em %s', (_name, sheetId, label, columns, rows, perSheet) => {
    const grid = computeSheetGrid(findSheetLayout(sheetId), label);

    expect(grid.columns).toBe(columns);
    expect(grid.rows).toBe(rows);
    expect(grid.perSheet).toBe(perSheet);
    expect(grid.cells).toHaveLength(perSheet);
  });

  it('informa a area util que usou', () => {
    expect(computeSheetGrid(RETRATO, GRANDE)).toMatchObject({
      usableWidthMm: 190,
      usableHeightMm: 277,
    });
    expect(computeSheetGrid(PAISAGEM, GRANDE)).toMatchObject({
      usableWidthMm: 277,
      usableHeightMm: 190,
    });
  });
});

describe('posicao das etiquetas', () => {
  it('parte do canto das margens e avanca por linha', () => {
    const { cells } = computeSheetGrid(RETRATO, PEQUENA);

    expect(cells[0]).toMatchObject({ index: 0, row: 0, column: 0, xMm: 10, yMm: 10 });
    expect(cells[1]).toMatchObject({ index: 1, row: 0, column: 1, xMm: 63, yMm: 10 });
    expect(cells[3]).toMatchObject({ index: 3, row: 1, column: 0, xMm: 10, yMm: 43 });
    // Ultima: coluna 2, linha 7. x = 10 + 2 x 53 = 116; y = 10 + 7 x 33 = 241.
    expect(cells[23]).toMatchObject({ index: 23, row: 7, column: 2, xMm: 116, yMm: 241 });
    expect(cells[23]).toMatchObject({ widthMm: 50, heightMm: 30 });
  });

  it('deixa a sobra a direita e embaixo, sem mexer na margem digitada', () => {
    const { cells } = computeSheetGrid(RETRATO, PEQUENA);
    const last = cells[cells.length - 1];

    // 210 - 10 - (116 + 50) = 34 mm de sobra entre a ultima coluna e a margem
    // direita; a margem esquerda continua 10.
    expect(RETRATO.widthMm - RETRATO.marginRightMm - (last.xMm + last.widthMm)).toBe(34);
    expect(cells.every((cell) => cell.xMm >= RETRATO.marginLeftMm)).toBe(true);
  });

  it('acompanha margens e espacamentos ajustados', () => {
    const { sheet } = buildSheetLayout('a4-retrato', {
      marginTopMm: 15.5,
      marginLeftMm: 7.5,
      columnGapMm: 0,
      rowGapMm: 2.5,
    });
    const grid = computeSheetGrid(sheet, PEQUENA);

    // Largura util 210 - 7,5 - 10 = 192,5: quatro de 50 nao cabem, tres sim.
    expect(grid.columns).toBe(3);
    expect(grid.cells[1]).toMatchObject({ xMm: 57.5, yMm: 15.5 });
    expect(grid.cells[3]).toMatchObject({ xMm: 7.5, yMm: 48 });
  });

  it('aceita o encaixe exato, sem perder a ultima peca por arredondamento', () => {
    // Largura util 210 - 9,5 - 10 = 190,5, sem espacamento: 3 x 63,5 = 190,5 exatos.
    const { sheet } = buildSheetLayout('a4-retrato', {
      marginLeftMm: 9.5,
      marginRightMm: 10,
      columnGapMm: 0,
    });
    const grid = computeSheetGrid(sheet, { widthMm: 63.5, heightMm: 30 });

    expect(grid.usableWidthMm).toBe(190.5);
    expect(grid.columns).toBe(3);
  });
});

describe('etiqueta que nao cabe na area util', () => {
  // As margens da tela vao ate 50 mm, e com esse teto a tag grande cabe sempre.
  // A folha abaixo passa pelo contrato, mas nao pela tela.
  const APERTADA = SheetLayoutSchema.parse({
    ...RETRATO,
    marginLeftMm: 60,
    marginRightMm: 60,
  });

  it('devolve grade sem posicao nenhuma, em vez de recusar', () => {
    const grid = computeSheetGrid(APERTADA, GRANDE);

    expect(grid.usableWidthMm).toBe(90);
    expect(grid.columns).toBe(0);
    expect(grid.rows).toBe(0);
    expect(grid.perSheet).toBe(0);
    expect(grid.cells).toEqual([]);
  });

  it('continua cabendo o modelo menor na mesma folha', () => {
    // Largura util 90: uma coluna de 50 (duas pedem 103). Altura 277: oito linhas.
    expect(computeSheetGrid(APERTADA, PEQUENA).perSheet).toBe(8);
  });

  it('escreve o motivo com as medidas da etiqueta e da area util', () => {
    const grid = computeSheetGrid(APERTADA, GRANDE);

    expect(describeEmptyGrid(grid, GRANDE)).toBe(
      'A etiqueta de 100 x 70 mm não cabe na área útil da folha (90 x 277 mm). ' +
        'Reduza as margens ou escolha outro modelo.',
    );
  });

  it('tambem zera a grade quando falta altura', () => {
    const baixa = SheetLayoutSchema.parse({ ...PAISAGEM, marginTopMm: 80, marginBottomMm: 70 });
    const grid = computeSheetGrid(baixa, GRANDE);

    expect(grid.usableHeightMm).toBe(60);
    expect(grid.perSheet).toBe(0);
    expect(describeEmptyGrid(grid, GRANDE)).toContain('(277 x 60 mm)');
  });

  it('nao e alcancavel com o teto de margem da tela', () => {
    const { sheet } = buildSheetLayout('a4-paisagem', {
      marginTopMm: 50,
      marginRightMm: 50,
      marginBottomMm: 50,
      marginLeftMm: 50,
    });

    expect(computeSheetGrid(sheet, GRANDE).perSheet).toBe(1);
  });
});
