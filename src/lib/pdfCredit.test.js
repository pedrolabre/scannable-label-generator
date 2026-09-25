// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { findLabelLayout } from '../domain/services/labelLayoutCatalog.js';
import { describePrintDocument } from '../domain/services/printDocument.js';
import { computeSheetGrid } from '../domain/services/sheetGrid.js';
import { findSheetLayout } from '../domain/services/sheetLayoutCatalog.js';

import { renderPrintDocument } from './pdf.js';
import { readContent } from './pdfBytes.js';

/**
 * O cartao, o crediario e a faixa da base conferidos na descricao e no arquivo
 * que sai: as linhas escritas com a conta do crediario, e a faixa desenhada uma
 * vez por etiqueta, na cor da marca e na caixa que a descricao deu, com a conta
 * de milimetro para ponto escrita aqui a mao.
 */

const POINTS_PER_MM = 72 / 25.4;
const CREATED_AT = new Date(Date.UTC(2026, 8, 25, 12, 0, 0));

const SHEET = findSheetLayout('a4-10-etiquetas');

const ARMARIO = {
  id: '11111111-1111-4111-8111-111111111111',
  systemCode: 'MOV-00412',
  displayName: 'Armário de cozinha',
  priceInCentavos: 100000,
};

const CREDIT = { rateHundredths: 800, interest: 'simples', installments: 10, roundToNinetyCents: false };

function describeSheet(labelId, credit) {
  const labelLayout = findLabelLayout(labelId);

  return describePrintDocument({
    job: { labelLayoutId: labelId, sheetLayoutId: SHEET.id, items: [{ productId: ARMARIO.id, copies: 3 }] },
    sheet: SHEET,
    labelLayout,
    grid: computeSheetGrid(SHEET, labelLayout),
    products: [ARMARIO],
    symbols: new Map(),
    header: { companyName: null, card: { installments: 10 }, credit, logo: null },
  });
}

function opsOf(description, type) {
  return description.pages[0].ops.filter((op) => op.type === type);
}

/** Cada retangulo preenchido logo depois da cor da faixa. */
function readBandDraws(content) {
  const lines = content.split('\n').map((line) => line.trim());

  return lines.flatMap((line, index) => {
    if (line !== '0.76 0.07 0.12 rg') {
      return [];
    }

    const [x, y, width, height] = lines[index + 1].split(/\s+/).map(Number);

    return [{ x, y, width, height }];
  });
}

describe('crediario e faixa na descricao do documento', () => {
  it('escreve cartao, parcela do crediario e taxa em cada etiqueta, nessa ordem', () => {
    const texts = opsOf(describeSheet('etiqueta-media-10', CREDIT), 'text').map((op) => op.text);
    const first = texts.slice(0, texts.indexOf('Sem símbolo') + 1);

    expect(first).toEqual([
      'MOV-00412',
      'ARMÁRIO DE COZINHA',
      'À VISTA',
      'R$ 1.000,00',
      '10x sem juros no cartão',
      'Crediário: 10x de R$ 180,00',
      'Taxa de Juros: 8% a.m.',
      'Sem símbolo',
    ]);
    expect(texts.filter((text) => text === 'Crediário: 10x de R$ 180,00')).toHaveLength(3);
  });

  it('desenha a faixa uma vez por etiqueta, com cor explicita', () => {
    const description = describeSheet('etiqueta-media-10', null);
    const bands = opsOf(description, 'band');
    const cells = computeSheetGrid(SHEET, findLabelLayout('etiqueta-media-10')).cells;

    expect(bands).toHaveLength(3);
    bands.forEach((band, index) => {
      expect(band.color).toEqual({ hex: '#C1121F', red: 193, green: 18, blue: 31 });
      expect(band.xMm - cells[index].xMm).toBeCloseTo(2.5, 10);
      expect(band.yMm - cells[index].yMm).toBeCloseTo(44.95, 10);
      expect(band.widthMm).toBeCloseTo(79.7, 10);
      expect(band.heightMm).toBeCloseTo(0.8, 10);
    });
    expect(opsOf(description, 'text').map((op) => op.text)).not.toContain('Crediário: 10x de R$ 180,00');
  });

  it('nao desenha faixa nem crediario na etiqueta media, que continua com o cartao', () => {
    const texts = opsOf(describeSheet('etiqueta-media', CREDIT), 'text').map((op) => op.text);

    expect(opsOf(describeSheet('etiqueta-media', CREDIT), 'band')).toHaveLength(0);
    expect(texts).not.toContain('Crediário: 10x de R$ 180,00');
    expect(texts).not.toContain('Taxa de Juros: 8% a.m.');
    expect(texts).toContain('10x sem juros no cartão');
  });
});

describe('crediario e faixa no arquivo', () => {
  it('grava as linhas do cartao e do crediario e a faixa na posicao e na cor', async () => {
    const description = describeSheet('etiqueta-media-10', { ...CREDIT, interest: 'composto' });
    const content = readContent(await renderPrintDocument(description, { createdAt: CREATED_AT }));
    const draws = readBandDraws(content);
    const bands = opsOf(description, 'band');

    // 1.000,00 x 0,08 / (1 - 1,08^-10) = 149,03.
    expect(content).toContain('(10x sem juros no cartão) Tj');
    expect(content).toContain('(Crediário: 10x de R$ 149,03) Tj');
    expect(content).toContain('(Taxa de Juros: 8% a.m.) Tj');
    expect(draws).toHaveLength(3);

    draws.forEach((draw, index) => {
      const op = bands[index];

      // O PDF conta y de baixo para cima, e o retangulo sobe do canto de cima.
      expect(draw.x).toBeCloseTo(op.xMm * POINTS_PER_MM, 3);
      expect(draw.y).toBeCloseTo((SHEET.heightMm - op.yMm) * POINTS_PER_MM, 3);
      expect(draw.width).toBeCloseTo(op.widthMm * POINTS_PER_MM, 3);
      expect(draw.height).toBeCloseTo(-op.heightMm * POINTS_PER_MM, 3);
    });
  }, 30_000);

  it('sem crediario, nao escreve linha de parcela nem de taxa, e o cartao continua', async () => {
    const content = readContent(
      await renderPrintDocument(describeSheet('tag-grande', null), { createdAt: CREATED_AT }),
    );

    expect(content).not.toContain('Taxa de Juros');
    expect(content).not.toContain('Crediário');
    expect(content).toContain('(10x sem juros no cartão) Tj');
    expect(readBandDraws(content)).toHaveLength(3);
  }, 30_000);
});
