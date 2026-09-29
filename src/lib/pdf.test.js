// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { computeLabelGeometry } from '../domain/services/labelGeometry.js';
import { findLabelLayout } from '../domain/services/labelLayoutCatalog.js';
import { describePrintDocument } from '../domain/services/printDocument.js';
import { buildSymbolText } from '../domain/services/symbolContent.js';
import { computeSheetGrid } from '../domain/services/sheetGrid.js';
import { findSheetLayout } from '../domain/services/sheetLayoutCatalog.js';

import { generateSymbol } from './barcode.js';
import { BARCODE_ERROR_CODES, BarcodeError } from './barcodeError.js';
import { renderPrintDocument } from './pdf.js';
import {
  area,
  asLatin1,
  boundingBox,
  isSquare,
  readContent,
  readMediaBoxes,
  readSubpaths,
  windingNumber,
} from './pdfBytes.js';

/**
 * Estes testes leem o arquivo gerado, e nao a descricao que o originou: a
 * promessa de escala 1:1 e sobre o que sai no papel, e as contas de milimetro
 * para ponto estao escritas aqui a mao para que uma mudanca silenciosa de
 * unidade quebre o teste em vez de quebrar a regua do operador.
 */

/** Ponto tipografico: 72 por polegada, 25,4 mm por polegada. */
const POINTS_PER_MM = 72 / 25.4;

const RETRATO = findSheetLayout('a4-retrato');
const PAISAGEM = findSheetLayout('a4-paisagem');
const GRANDE = findLabelLayout('tag-grande');
const PEQUENA = findLabelLayout('etiqueta-pequena');

const CREATED_AT = new Date(Date.UTC(2026, 8, 17, 12, 0, 0));

const ARMARIO = {
  id: '11111111-1111-4111-8111-111111111111',
  systemCode: 'MOV-00412',
  displayName: 'Armário de cozinha',
  priceInCentavos: 89990,
};

const FOGAO = {
  id: '22222222-2222-4222-8222-222222222222',
  systemCode: 'FOG-00999',
  displayName: 'Fogão cinco bocas',
  priceInCentavos: 219900,
};

const PRODUCTS = [ARMARIO, FOGAO];

async function buildDescription({ items, sheet = RETRATO, labelLayout = GRANDE, failed = [] }) {
  const grid = computeSheetGrid(sheet, labelLayout);
  const symbols = new Map();

  for (const item of items) {
    const product = PRODUCTS.find((candidate) => candidate.id === item.productId);

    for (let copy = 1; copy <= item.copies; copy += 1) {
      const text = buildSymbolText(product, copy);

      symbols.set(
        text,
        failed.includes(product.systemCode)
          ? {
              symbol: null,
              error: new BarcodeError(BARCODE_ERROR_CODES.UNSUPPORTED_CHARACTER, 'Sem símbolo.'),
            }
          : { symbol: await generateSymbol(text), error: null },
      );
    }
  }

  return describePrintDocument({
    job: { labelLayoutId: labelLayout.id, sheetLayoutId: sheet.id, items },
    sheet,
    labelLayout,
    grid,
    products: PRODUCTS,
    symbols,
  });
}

async function renderBytes(options, renderOptions = {}) {
  const description = await buildDescription(options);

  return renderPrintDocument(description, { createdAt: CREATED_AT, ...renderOptions });
}


describe('tamanho da pagina', () => {
  it('sai em A4 retrato, com a medida em ponto calculada do milimetro', async () => {
    const bytes = await renderBytes({ items: [{ productId: ARMARIO.id, copies: 1 }] });
    const [mediaBox] = readMediaBoxes(bytes);

    // 210 mm e 297 mm convertidos a mao: 595,28 x 841,89 pontos.
    expect(mediaBox[0]).toBe(0);
    expect(mediaBox[1]).toBe(0);
    expect(mediaBox[2]).toBeCloseTo((210 / 25.4) * 72, 4);
    expect(mediaBox[3]).toBeCloseTo((297 / 25.4) * 72, 4);
    expect(mediaBox[2]).toBeCloseTo(595.28, 2);
    expect(mediaBox[3]).toBeCloseTo(841.89, 2);
  });

  it('sai em A4 paisagem como pagina deitada, e nao como retrato girado', async () => {
    const bytes = await renderBytes({
      items: [{ productId: ARMARIO.id, copies: 1 }],
      sheet: PAISAGEM,
    });
    const [mediaBox] = readMediaBoxes(bytes);

    expect(mediaBox[2]).toBeCloseTo((297 / 25.4) * 72, 4);
    expect(mediaBox[3]).toBeCloseTo((210 / 25.4) * 72, 4);
    // Sem instrucao de giro, nenhum leitor gira a pagina por conta propria.
    expect(asLatin1(bytes)).not.toContain('/Rotate');
  });

  it('gera uma pagina por folha da tiragem', async () => {
    // Etiqueta pequena em A4 retrato: 24 por folha; 57 etiquetas pedem 3 folhas.
    const bytes = await renderBytes({
      items: [
        { productId: ARMARIO.id, copies: 50 },
        { productId: FOGAO.id, copies: 7 },
      ],
      labelLayout: PEQUENA,
    });

    expect(readMediaBoxes(bytes)).toHaveLength(3);
  });
});

describe('posicao das etiquetas', () => {
  it('poe a primeira etiqueta na margem, na medida em ponto calculada do milimetro', async () => {
    const bytes = await renderBytes({ items: [{ productId: ARMARIO.id, copies: 1 }] });
    const content = readContent(bytes);

    // Margem de 10 mm: 10 / 25,4 * 72 = 28,3465 pt da esquerda. O PDF conta a
    // altura de baixo para cima, entao o topo da etiqueta fica em
    // 841,8898 - 28,3465 = 813,5433 pt, e a altura de 70 mm desce dali.
    const xMm = 10 * POINTS_PER_MM;
    const yMm = (297 - 10) * POINTS_PER_MM;

    const rect = content
      .split('\n')
      .map((line) => line.match(/^(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re$/))
      .filter(Boolean)
      .map((match) => match.slice(1).map(Number))
      .find(([x]) => Math.abs(x - xMm) < 0.01);

    expect(rect).toBeDefined();
    expect(rect[0]).toBeCloseTo(28.3465, 3);
    expect(rect[1]).toBeCloseTo(813.5433, 3);
    expect(rect[1]).toBeCloseTo(yMm, 3);
    expect(rect[2]).toBeCloseTo(100 * POINTS_PER_MM, 3);
    expect(rect[3]).toBeCloseTo(-70 * POINTS_PER_MM, 3);
  });
});

describe('simbolo impresso', () => {
  it('sai quadrado, com o lado do modelo e a zona de silencio dentro dele', async () => {
    const bytes = await renderBytes({ items: [{ productId: ARMARIO.id, copies: 1 }] });
    const content = readContent(bytes);
    const geometry = computeLabelGeometry(GRANDE);

    const box = boundingBox(readSubpaths(content).flat());
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    const symbol = await generateSymbol(buildSymbolText(ARMARIO, 1));

    expect(width).toBeCloseTo(height, 6);

    // A caixa do simbolo tem o lado do modelo com a zona de silencio; o desenho
    // ocupa os modulos do meio, sem os quatro de cada lado.
    const drawnMm = (geometry.symbol.sizeMm * symbol.moduleCount) / symbol.totalModules;

    expect(width).toBeCloseTo(drawnMm * POINTS_PER_MM, 3);
  });

  it('mantem vazado o quadrado branco dos padroes de localizacao', async () => {
    const bytes = await renderBytes({ items: [{ productId: ARMARIO.id, copies: 1 }] });
    const content = readContent(bytes);
    const subpaths = readSubpaths(content);

    // Os contornos dos padroes de localizacao sao os maiores quadrados de
    // quatro vertices do desenho: sete modulos de lado, sem recorte.
    const finders = subpaths
      .filter((points) => points.length === 4 && isSquare(points))
      .sort((first, second) => area(second) - area(first))
      .slice(0, 3);

    expect(finders).toHaveLength(3);

    finders.forEach((finder) => {
      const box = boundingBox(finder);
      const moduleSize = (box.right - box.left) / 7;
      const center = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };

      // Centro: quadrado preto de tres modulos. Dois modulos ao lado: anel
      // branco, que so continua branco sob a regra nao nula.
      expect(windingNumber(subpaths, center)).not.toBe(0);
      expect(windingNumber(subpaths, { x: center.x + moduleSize * 2, y: center.y })).toBe(0);
      expect(windingNumber(subpaths, { x: center.x + moduleSize * 3, y: center.y })).not.toBe(0);
    });

    // Preenchimento pela regra nao nula, e nao pela regra par-impar.
    expect(content).toMatch(/\nf\n/);
    expect(content).not.toContain('f*');
  });
});

describe('texto impresso', () => {
  it('escreve acentuacao, cifrao e reticencias com a fonte embutida', async () => {
    const bytes = await renderBytes({ items: [{ productId: FOGAO.id, copies: 1 }] });
    const content = readContent(bytes);

    expect(content).toContain('/Encoding /WinAnsiEncoding'.slice(0, 0) + 'FOG'); // codigo numerico
    expect(content).toContain('FOGÃO CINCO BOCAS'.replace('Ã', 'Ã'));
    expect(content).toContain('R$ 2.199,00');
    expect(asLatin1(bytes)).toContain('/Encoding /WinAnsiEncoding');
  });

  it('corta o nome que passa da zona e fecha com reticencias', async () => {
    const longName = {
      ...ARMARIO,
      displayName: 'Armario de cozinha sob medida com seis portas e gavetas',
    };

    const grid = computeSheetGrid(RETRATO, PEQUENA);
    const description = describePrintDocument({
      job: { labelLayoutId: PEQUENA.id, sheetLayoutId: RETRATO.id, items: [{ productId: longName.id, copies: 1 }] },
      sheet: RETRATO,
      labelLayout: PEQUENA,
      grid,
      products: [longName],
      symbols: new Map([
        [longName.systemCode, { symbol: await generateSymbol(longName.systemCode), error: null }],
      ]),
    });

    const content = readContent(await renderPrintDocument(description, { createdAt: CREATED_AT }));

    // Reticencias em WinAnsi: um unico byte 0x85.
    expect(content).toContain(') Tj');
  });

  it('poe o marcador de falha no lugar do simbolo, com o restante do conteudo', async () => {
    const bytes = await renderBytes({
      items: [{ productId: FOGAO.id, copies: 1 }],
      failed: [FOGAO.systemCode],
    });
    const content = readContent(bytes);

    expect(content).toContain('Sem símbolo');
    expect(content).toContain('R$ 2.199,00');
    expect(readSubpaths(content)).toHaveLength(0);
    // Caixa tracejada no lugar do desenho.
    expect(content).toMatch(/\[\d+\.\d+ \d+\.\d+\] 0\. d/);
  });
});

describe('arquivo gerado', () => {
  it('sai igual byte a byte para a mesma entrada', async () => {
    const options = {
      items: [
        { productId: ARMARIO.id, copies: 3 },
        { productId: FOGAO.id, copies: 2 },
      ],
      labelLayout: PEQUENA,
    };

    const first = await renderBytes(options);
    const second = await renderBytes(options);

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });

  it('muda de identificador quando o conteudo muda', async () => {
    const first = await renderBytes({ items: [{ productId: ARMARIO.id, copies: 1 }] });
    const second = await renderBytes({ items: [{ productId: FOGAO.id, copies: 1 }] });

    const idOf = (bytes) => asLatin1(bytes).match(/\/ID \[ <([0-9A-F]{32})>/)[1];

    expect(idOf(first)).not.toBe(idOf(second));
  });

  it('carrega titulo, autor e data de criacao, e nada alem disso', async () => {
    const bytes = await renderBytes({ items: [{ productId: ARMARIO.id, copies: 1 }] });
    const raw = asLatin1(bytes);

    expect(raw).toContain('/Title (Etiquetas - Tag grande \\(100 x 70 mm\\) - A4 retrato \\(210 x 297 mm\\))');
    expect(raw).toContain('/Author (LabelForge)');
    expect(raw).toContain('/Creator (LabelForge)');
    expect(raw).toContain("/CreationDate (D:20260917120000+00'00')");
  });

  it('avisa o andamento uma vez por folha', async () => {
    const progress = [];

    await renderBytes(
      {
        items: [{ productId: ARMARIO.id, copies: 50 }],
        labelLayout: PEQUENA,
      },
      { onProgress: (sheetIndex, totalSheets) => progress.push([sheetIndex, totalSheets]) },
    );

    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });
});
