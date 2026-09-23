// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  COMPACT_SHEET_ADJUSTMENTS,
  MAX_COPIES,
  SHEET_FIELDS,
  findSheetField,
  formatMillimeters,
  isCompactSheet,
  parseCopies,
  parseMillimeters,
} from './printInputs.js';

const MARGEM_ESQUERDA = findSheetField('marginLeftMm');

describe('parseCopies', () => {
  it('le um inteiro positivo', () => {
    expect(parseCopies('12')).toEqual({ value: 12, error: null });
  });

  it('ignora espaco em volta do numero', () => {
    expect(parseCopies('  7  ')).toEqual({ value: 7, error: null });
  });

  it('recusa campo vazio sem completar com um', () => {
    const { value, error } = parseCopies('');

    expect(value).toBeNull();
    expect(error).toBe('Informe a quantidade de etiquetas');
  });

  it('recusa zero', () => {
    expect(parseCopies('0').error).toBe('Quantidade de etiquetas deve ser maior que zero');
  });

  it('recusa numero negativo', () => {
    expect(parseCopies('-3').error).toBe('Quantidade de etiquetas deve ser maior que zero');
  });

  it('recusa decimal com virgula ou com ponto', () => {
    expect(parseCopies('1,5').error).toBe('Quantidade de etiquetas deve ser um número inteiro');
    expect(parseCopies('1.5').error).toBe('Quantidade de etiquetas deve ser um número inteiro');
  });

  it('recusa texto que nao e numero', () => {
    expect(parseCopies('duas').error).toBe('Quantidade de etiquetas deve ser um número inteiro');
  });

  it('recusa acima do teto da tela', () => {
    expect(parseCopies(String(MAX_COPIES)).value).toBe(MAX_COPIES);
    expect(parseCopies(String(MAX_COPIES + 1)).error).toBe(
      `Quantidade de etiquetas deve ser no máximo ${MAX_COPIES}`,
    );
  });
});

describe('parseMillimeters', () => {
  it('le numero inteiro', () => {
    expect(parseMillimeters('10', MARGEM_ESQUERDA)).toEqual({ value: 10, error: null });
  });

  it('aceita virgula e ponto como separador decimal', () => {
    expect(parseMillimeters('10,5', MARGEM_ESQUERDA).value).toBe(10.5);
    expect(parseMillimeters('10.5', MARGEM_ESQUERDA).value).toBe(10.5);
  });

  it('arredonda para uma casa, que e a resolucao do passo', () => {
    expect(parseMillimeters('10,04', MARGEM_ESQUERDA).value).toBe(10);
    expect(parseMillimeters('10,46', MARGEM_ESQUERDA).value).toBe(10.5);
  });

  it('recusa campo vazio', () => {
    expect(parseMillimeters('', MARGEM_ESQUERDA).error).toBe(
      'Margem esquerda: informe um valor em milímetros',
    );
  });

  it('recusa texto que nao e numero', () => {
    expect(parseMillimeters('dez', MARGEM_ESQUERDA).error).toBe(
      'Margem esquerda deve ser um número em milímetros',
    );
  });

  it('recusa valor negativo', () => {
    expect(parseMillimeters('-1', MARGEM_ESQUERDA).error).toBe(
      'Margem esquerda não pode ser negativo',
    );
  });

  it('recusa acima do teto do campo', () => {
    expect(parseMillimeters(String(MARGEM_ESQUERDA.max + 1), MARGEM_ESQUERDA).error).toBe(
      `Margem esquerda deve ser no máximo ${MARGEM_ESQUERDA.max} mm`,
    );
  });
});

describe('campos da folha', () => {
  it('descreve as quatro margens e os dois espacamentos', () => {
    expect(SHEET_FIELDS.map((field) => field.key)).toEqual([
      'marginTopMm',
      'marginRightMm',
      'marginBottomMm',
      'marginLeftMm',
      'columnGapMm',
      'rowGapMm',
    ]);
  });

  it('nao encontra campo fora da lista', () => {
    expect(findSheetField('widthMm')).toBeNull();
  });

  it('exibe o milimetro com virgula', () => {
    expect(formatMillimeters(10.5)).toBe('10,5');
    expect(formatMillimeters(10)).toBe('10');
  });
});

describe('ajuste que aproveita a folha', () => {
  it('reconhece os seis campos no ajuste, com virgula ou ponto', () => {
    expect(isCompactSheet(COMPACT_SHEET_ADJUSTMENTS)).toBe(true);
    expect(isCompactSheet({ ...COMPACT_SHEET_ADJUSTMENTS, marginTopMm: '5,0' })).toBe(true);
  });

  it('nao reconhece quando um campo foge do ajuste ou esta vazio', () => {
    expect(isCompactSheet({ ...COMPACT_SHEET_ADJUSTMENTS, rowGapMm: '3' })).toBe(false);
    expect(isCompactSheet({ ...COMPACT_SHEET_ADJUSTMENTS, marginLeftMm: '' })).toBe(false);
    expect(isCompactSheet(undefined)).toBe(false);
  });
});
