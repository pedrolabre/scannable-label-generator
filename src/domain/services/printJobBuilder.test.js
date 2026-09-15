// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  ADJUSTABLE_SHEET_FIELDS,
  buildPrintJob,
  buildSheetLayout,
  countCopies,
} from './printJobBuilder.js';
import { findSheetLayout } from './sheetLayoutCatalog.js';

const ARMARIO_ID = '11111111-1111-4111-8111-111111111111';
const GELADEIRA_ID = '22222222-2222-4222-8222-222222222222';

const JOB_BASE = {
  labelLayoutId: 'tag-grande',
  sheetLayoutId: 'a4-retrato',
};

describe('catalogo de folhas', () => {
  it('traz A4 nas duas orientacoes, e a paisagem e a retrato trocada', () => {
    const retrato = findSheetLayout('a4-retrato');
    const paisagem = findSheetLayout('a4-paisagem');

    expect(retrato.widthMm).toBe(210);
    expect(retrato.heightMm).toBe(297);
    expect(paisagem.widthMm).toBe(retrato.heightMm);
    expect(paisagem.heightMm).toBe(retrato.widthMm);
  });

  it('nao encontra modelo fora do catalogo', () => {
    expect(findSheetLayout('carta')).toBeNull();
  });
});

describe('buildSheetLayout', () => {
  it('parte dos valores do modelo quando nao ha ajuste', () => {
    const { sheet, errors } = buildSheetLayout('a4-retrato');

    expect(errors.general).toHaveLength(0);
    expect(sheet).toEqual(findSheetLayout('a4-retrato'));
  });

  it('substitui apenas os seis campos ajustaveis', () => {
    const { sheet } = buildSheetLayout('a4-retrato', {
      marginTopMm: 5,
      marginRightMm: 5,
      marginBottomMm: 5,
      marginLeftMm: 5,
      columnGapMm: 0,
      rowGapMm: 1.5,
    });

    expect(sheet.marginTopMm).toBe(5);
    expect(sheet.rowGapMm).toBe(1.5);
    expect(sheet.columnGapMm).toBe(0);
    expect(sheet.widthMm).toBe(210);
    expect(sheet.name).toBe('A4 retrato (210 x 297 mm)');
    expect(ADJUSTABLE_SHEET_FIELDS).toHaveLength(6);
  });

  it('recusa margens laterais que consomem a largura da folha', () => {
    const { sheet, errors } = buildSheetLayout('a4-retrato', {
      marginLeftMm: 120,
      marginRightMm: 120,
    });

    expect(sheet).toBeNull();
    expect(errors.fields.marginLeftMm).toBe('Margens laterais ocupam toda a largura da folha');
  });

  it('recusa margens verticais que consomem a altura da folha', () => {
    const { sheet, errors } = buildSheetLayout('a4-retrato', {
      marginTopMm: 150,
      marginBottomMm: 150,
    });

    expect(sheet).toBeNull();
    expect(errors.fields.marginTopMm).toBe('Margens verticais ocupam toda a altura da folha');
  });

  it('recusa medida negativa com a mensagem do proprio campo', () => {
    const { errors } = buildSheetLayout('a4-retrato', { marginLeftMm: -1 });

    expect(errors.fields.marginLeftMm).toBe('Margem esquerda não pode ser negativo');
  });

  it('recusa modelo de folha desconhecido', () => {
    const { sheet, errors } = buildSheetLayout('carta');

    expect(sheet).toBeNull();
    expect(errors.general).toEqual(['Escolha um modelo de folha para a impressão.']);
  });
});

describe('buildPrintJob', () => {
  it('leva a quantidade de cada produto para o trabalho com o valor digitado', () => {
    const { job, errors } = buildPrintJob({
      ...JOB_BASE,
      items: [
        { productId: ARMARIO_ID, copies: 3 },
        { productId: GELADEIRA_ID, copies: 12 },
      ],
    });

    expect(errors.general).toHaveLength(0);
    expect(job.items).toEqual([
      { productId: ARMARIO_ID, copies: 3 },
      { productId: GELADEIRA_ID, copies: 12 },
    ]);
    expect(countCopies(job.items)).toBe(15);
  });

  it('nao guarda identificador nem data, porque o trabalho nunca e gravado', () => {
    const { job } = buildPrintJob({
      ...JOB_BASE,
      items: [{ productId: ARMARIO_ID, copies: 1 }],
    });

    expect(Object.keys(job).sort()).toEqual(['items', 'labelLayoutId', 'sheetLayoutId']);
  });

  it('recusa selecao vazia com a mensagem que o operador le', () => {
    const { job, errors } = buildPrintJob({ ...JOB_BASE, items: [] });

    expect(job).toBeNull();
    expect(errors.fields.items).toBe('Selecione ao menos um produto para imprimir');
  });

  it('recusa o mesmo produto duas vezes na selecao', () => {
    const { job, errors } = buildPrintJob({
      ...JOB_BASE,
      items: [
        { productId: ARMARIO_ID, copies: 1 },
        { productId: ARMARIO_ID, copies: 2 },
      ],
    });

    expect(job).toBeNull();
    expect(errors.fields['items.1.productId']).toBe(
      'Produto repetido na seleção: some as quantidades em um único item',
    );
  });

  it('recusa quantidade nula ou fracionada', () => {
    expect(
      buildPrintJob({ ...JOB_BASE, items: [{ productId: ARMARIO_ID, copies: 0 }] }).errors.fields[
        'items.0.copies'
      ],
    ).toBe('Quantidade de etiquetas deve ser maior que zero');

    expect(
      buildPrintJob({ ...JOB_BASE, items: [{ productId: ARMARIO_ID, copies: 1.5 }] }).errors.fields[
        'items.0.copies'
      ],
    ).toBe('Quantidade de etiquetas deve ser um número inteiro');
  });

  it('recusa modelo de etiqueta fora do catalogo', () => {
    const { job, errors } = buildPrintJob({
      ...JOB_BASE,
      labelLayoutId: 'tag-gigante',
      items: [{ productId: ARMARIO_ID, copies: 1 }],
    });

    expect(job).toBeNull();
    expect(errors.general).toEqual(['Escolha um modelo de etiqueta para a impressão.']);
  });
});

describe('countCopies', () => {
  it('soma as etiquetas do trabalho', () => {
    expect(countCopies([{ copies: 2 }, { copies: 5 }])).toBe(7);
  });

  it('responde zero sem itens', () => {
    expect(countCopies([])).toBe(0);
    expect(countCopies(null)).toBe(0);
  });
});
