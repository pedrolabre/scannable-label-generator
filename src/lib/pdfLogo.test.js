// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { resolveLogo } from '../domain/services/logoImage.js';
import { findLabelLayout } from '../domain/services/labelLayoutCatalog.js';
import { describePrintDocument } from '../domain/services/printDocument.js';
import { computeSheetGrid } from '../domain/services/sheetGrid.js';
import { findSheetLayout } from '../domain/services/sheetLayoutCatalog.js';

import { JPEG_8X4_DATA_URL, pngDataUrl } from './logoFixtures.js';
import { renderPrintDocument } from './pdf.js';
import { asLatin1, readContent } from './pdfBytes.js';

/**
 * O logotipo conferido no arquivo que sai, e nao na descricao: o objeto de
 * imagem gravado uma vez, e o desenho dele em cada etiqueta na caixa que a
 * descricao deu, com a conta de milimetro para ponto escrita aqui a mao.
 */

const POINTS_PER_MM = 72 / 25.4;
const CREATED_AT = new Date(Date.UTC(2026, 8, 25, 12, 0, 0));

const SHEET = findSheetLayout('a4-10-etiquetas');
const LABEL = findLabelLayout('etiqueta-media-10');

const ARMARIO = {
  id: '11111111-1111-4111-8111-111111111111',
  systemCode: 'MOV-00412',
  displayName: 'Armário de cozinha',
  priceInCentavos: 89990,
};

function describeTen(logo) {
  return describePrintDocument({
    job: { labelLayoutId: LABEL.id, sheetLayoutId: SHEET.id, items: [{ productId: ARMARIO.id, copies: 10 }] },
    sheet: SHEET,
    labelLayout: LABEL,
    grid: computeSheetGrid(SHEET, LABEL),
    products: [ARMARIO],
    symbols: new Map(),
    header: { companyName: 'Loja Inventada', logo },
  });
}

/** Cada desenho de imagem do fluxo: a matriz `cm` logo antes do `Do`. */
function readImageDraws(content) {
  const lines = content.split('\n');

  return lines.flatMap((line, index) => {
    if (!/^\/I\d+ Do$/.test(line.trim())) {
      return [];
    }

    const [width, , , height, x, y] = lines[index - 1].trim().split(/\s+/).map(Number);

    return [{ name: line.trim().split(' ')[0], width, height, x, y }];
  });
}

function countImageObjects(bytes) {
  return (asLatin1(bytes).match(/\/Subtype \/Image/g) ?? []).length;
}

describe('logotipo no arquivo', () => {
  it('grava a imagem uma vez e a desenha em cada etiqueta, na caixa da descricao', async () => {
    const description = describeTen(resolveLogo(pngDataUrl(300, 60)));
    const bytes = await renderPrintDocument(description, { createdAt: CREATED_AT });
    const draws = readImageDraws(readContent(bytes));
    const images = description.pages[0].ops.filter((op) => op.type === 'image');

    expect(countImageObjects(bytes)).toBe(1);
    expect(draws).toHaveLength(10);
    expect(new Set(draws.map((draw) => draw.name)).size).toBe(1);

    draws.forEach((draw, index) => {
      const op = images[index];

      // O PDF conta y de baixo para cima: o canto de referencia e o de baixo.
      expect(draw.width).toBeCloseTo(op.widthMm * POINTS_PER_MM, 3);
      expect(draw.height).toBeCloseTo(op.heightMm * POINTS_PER_MM, 3);
      expect(draw.x).toBeCloseTo(op.xMm * POINTS_PER_MM, 3);
      expect(draw.y).toBeCloseTo((SHEET.heightMm - op.yMm - op.heightMm) * POINTS_PER_MM, 3);
    });
  }, 30_000);

  it('grava o JPEG como JPEG, sem reconverter', async () => {
    const bytes = await renderPrintDocument(describeTen(resolveLogo(JPEG_8X4_DATA_URL)), {
      createdAt: CREATED_AT,
    });

    expect(countImageObjects(bytes)).toBe(1);
    expect(asLatin1(bytes)).toContain('/Filter /DCTDecode');
    expect(readImageDraws(readContent(bytes))).toHaveLength(10);
  }, 30_000);

  it('sem logotipo, nao grava objeto de imagem nenhum', async () => {
    const bytes = await renderPrintDocument(describeTen(null), { createdAt: CREATED_AT });

    expect(countImageObjects(bytes)).toBe(0);
    expect(readImageDraws(readContent(bytes))).toHaveLength(0);
  }, 30_000);

  it('continua gerando o mesmo arquivo para a mesma entrada', async () => {
    const description = describeTen(resolveLogo(pngDataUrl(120, 40)));
    const first = await renderPrintDocument(description, { createdAt: CREATED_AT });
    const second = await renderPrintDocument(description, { createdAt: CREATED_AT });

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  }, 30_000);
});
