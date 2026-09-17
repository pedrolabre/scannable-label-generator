// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  MAX_EXPORT_LABELS,
  buildExportFileName,
  countExportLabels,
  describeExportLimit,
  describeExportProgress,
  exceedsExportLimit,
  listExportSystemCodes,
} from './printExport.js';

const ARMARIO_ID = '11111111-1111-4111-8111-111111111111';
const GELADEIRA_ID = '22222222-2222-4222-8222-222222222222';

const PRODUCTS = [
  { id: ARMARIO_ID, systemCode: 'MOV-00412' },
  { id: GELADEIRA_ID, systemCode: 'ELE-00713' },
];

describe('teto de exportacao', () => {
  it('soma as copias de todos os itens', () => {
    expect(
      countExportLabels([
        { productId: ARMARIO_ID, copies: 999 },
        { productId: GELADEIRA_ID, copies: 1 },
      ]),
    ).toBe(1000);
  });

  it('aceita a tiragem que fecha exatamente no teto', () => {
    const items = [{ productId: ARMARIO_ID, copies: MAX_EXPORT_LABELS }];

    expect(exceedsExportLimit(items)).toBe(false);
    expect(describeExportLimit(items)).toBeNull();
  });

  it('recusa uma etiqueta acima do teto, com o motivo que o operador le', () => {
    const items = [{ productId: ARMARIO_ID, copies: MAX_EXPORT_LABELS + 1 }];

    expect(exceedsExportLimit(items)).toBe(true);
    expect(describeExportLimit(items)).toBe(
      `A seleção tem ${MAX_EXPORT_LABELS + 1} etiquetas e o limite de exportação é ` +
        `${MAX_EXPORT_LABELS}. Reduza as cópias ou exporte em partes.`,
    );
  });

  it('soma as copias de varios produtos antes de comparar com o teto', () => {
    // Doze produtos com 999 copias passam de onze mil etiquetas.
    const items = Array.from({ length: 12 }, (unused, index) => ({
      productId: `${index}`,
      copies: 999,
    }));

    expect(exceedsExportLimit(items)).toBe(true);
  });
});

describe('andamento e nome do arquivo', () => {
  it('escreve a folha em que a geracao esta', () => {
    expect(describeExportProgress(3, 12)).toBe('Gerando folha 3 de 12…');
  });

  it('monta o nome com a data local e o modelo da etiqueta', () => {
    expect(buildExportFileName(new Date(2026, 8, 17, 9, 30), 'tag-grande')).toBe(
      'labelforge-etiquetas-2026-09-17-tag-grande.pdf',
    );
  });

  it('preenche mes e dia com dois algarismos', () => {
    expect(buildExportFileName(new Date(2026, 0, 5), 'etiqueta-pequena')).toBe(
      'labelforge-etiquetas-2026-01-05-etiqueta-pequena.pdf',
    );
  });
});

describe('codigos da tiragem', () => {
  it('devolve um codigo por produto marcado, na ordem da selecao', () => {
    const codes = listExportSystemCodes(
      [
        { productId: GELADEIRA_ID, copies: 500 },
        { productId: ARMARIO_ID, copies: 500 },
      ],
      PRODUCTS,
    );

    expect(codes).toEqual(['ELE-00713', 'MOV-00412']);
  });

  it('ignora identificador que nao resolve na lista atual', () => {
    expect(listExportSystemCodes([{ productId: 'sumiu', copies: 1 }], PRODUCTS)).toEqual([]);
  });
});
