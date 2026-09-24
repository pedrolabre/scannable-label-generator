// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { generateSymbol } from '../../lib/barcode.js';
import { BARCODE_ERROR_CODES, BarcodeError } from '../../lib/barcodeError.js';

import { computeLabelGeometry } from './labelGeometry.js';
import { findLabelLayout } from './labelLayoutCatalog.js';
import { describePrintDocument } from './printDocument.js';
import { listExportSymbolTexts } from './printExport.js';
import { buildSymbolText } from './symbolContent.js';
import { computeSheetGrid } from './sheetGrid.js';
import { findSheetLayout } from './sheetLayoutCatalog.js';

const RETRATO = findSheetLayout('a4-retrato');
const PAISAGEM = findSheetLayout('a4-paisagem');
const GRANDE = findLabelLayout('tag-grande');
const MEDIA = findLabelLayout('etiqueta-media');
const PEQUENA = findLabelLayout('etiqueta-pequena');

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

const FAILED_SYMBOL = {
  symbol: null,
  error: new BarcodeError(BARCODE_ERROR_CODES.UNSUPPORTED_CHARACTER, 'Código sem símbolo.'),
};

async function symbolsFor(texts) {
  const entries = await Promise.all(
    texts.map(async (text) => [text, { symbol: await generateSymbol(text), error: null }]),
  );

  return new Map(entries);
}

async function describe1({ items, sheet = RETRATO, labelLayout = GRANDE, symbols, header }) {
  const grid = computeSheetGrid(sheet, labelLayout);

  return describePrintDocument({
    job: { labelLayoutId: labelLayout.id, sheetLayoutId: sheet.id, items },
    sheet,
    labelLayout,
    grid,
    products: PRODUCTS,
    symbols: symbols ?? (await symbolsFor(listExportSymbolTexts(items, PRODUCTS))),
    header,
  });
}

function opsOfType(page, type) {
  return page.ops.filter((op) => op.type === type);
}

function textsOf(page) {
  return opsOfType(page, 'text').map((op) => op.text);
}

describe('paginas e medidas da folha', () => {
  it('descreve a pagina com a medida do modelo de folha, em retrato e em paisagem', async () => {
    const retrato = await describe1({ items: [{ productId: ARMARIO.id, copies: 1 }] });
    const paisagem = await describe1({
      items: [{ productId: ARMARIO.id, copies: 1 }],
      sheet: PAISAGEM,
    });

    expect(retrato.pages[0].widthMm).toBe(210);
    expect(retrato.pages[0].heightMm).toBe(297);
    expect(paisagem.pages[0].widthMm).toBe(297);
    expect(paisagem.pages[0].heightMm).toBe(210);
  });

  it('gera uma pagina por folha da tiragem', async () => {
    // Etiqueta pequena em A4 retrato: 24 por folha; 57 etiquetas pedem 3 folhas.
    const document = await describe1({
      items: [
        { productId: ARMARIO.id, copies: 50 },
        { productId: FOGAO.id, copies: 7 },
      ],
      labelLayout: PEQUENA,
    });

    expect(document.pages).toHaveLength(3);
    // A ultima folha recebe as nove etiquetas que sobraram.
    expect(opsOfType(document.pages[2], 'path')).toHaveLength(9);
  });

  it('nomeia o documento com o modelo da etiqueta e o da folha', async () => {
    const document = await describe1({ items: [{ productId: ARMARIO.id, copies: 1 }] });

    expect(document.title).toBe(`Etiquetas - ${GRANDE.name} - ${RETRATO.name}`);
  });
});

describe('conteudo de uma etiqueta', () => {
  it('posiciona as zonas a partir do canto da etiqueta na folha', async () => {
    const document = await describe1({ items: [{ productId: ARMARIO.id, copies: 1 }] });
    const geometry = computeLabelGeometry(GRANDE);
    const [page] = document.pages;

    // Primeira posicao da grade com as margens do catalogo: 10 mm por 10 mm.
    const [background] = opsOfType(page, 'rect');

    expect(background).toMatchObject({ xMm: 10, yMm: 10, widthMm: 100, heightMm: 70 });

    const [symbolBox] = opsOfType(page, 'rect').slice(1);

    expect(symbolBox.xMm).toBeCloseTo(10 + geometry.symbol.xMm, 6);
    expect(symbolBox.yMm).toBeCloseTo(10 + geometry.symbol.yMm, 6);
    expect(symbolBox.widthMm).toBe(geometry.symbol.sizeMm);
    expect(symbolBox.heightMm).toBe(geometry.symbol.sizeMm);
  });

  it('escreve codigo, nome em caixa alta, a vista e preco em reais, com acentuacao completa', async () => {
    const document = await describe1({ items: [{ productId: FOGAO.id, copies: 1 }] });

    expect(textsOf(document.pages[0])).toEqual([
      'FOG-00999',
      'FOGÃO CINCO BOCAS',
      'À VISTA',
      'R$ 2.199,00',
    ]);
  });

  it('escreve a empresa, o parcelamento e a linha fiscal quando existem', async () => {
    const products = [{ ...FOGAO, ean: '7899075420416', ncm: '94035000' }];
    const items = [{ productId: FOGAO.id, copies: 1 }];
    const grid = computeSheetGrid(RETRATO, GRANDE);
    const document = describePrintDocument({
      job: { labelLayoutId: GRANDE.id, sheetLayoutId: RETRATO.id, items },
      sheet: RETRATO,
      labelLayout: GRANDE,
      grid,
      products,
      symbols: await symbolsFor(listExportSymbolTexts(items, products)),
      header: { companyName: 'Loja Inventada', installmentText: 'Taxa de juros: 8% a.m.' },
    });

    expect(textsOf(document.pages[0])).toEqual([
      'FOG-00999',
      'Loja Inventada',
      'FOGÃO CINCO BOCAS',
      'À VISTA',
      'R$ 2.199,00',
      'Taxa de juros: 8% a.m.',
      'EAN 7899075420416 · NCM 9403.50.00',
    ]);
    expect(opsOfType(document.pages[0], 'text')[1].align).toBe('right');
  });

  it('grava em cada copia o texto do proprio exemplar', async () => {
    const document = await describe1({ items: [{ productId: ARMARIO.id, copies: 3 }] });
    const paths = document.pages.flatMap((page) => opsOfType(page, 'path'));

    expect(paths.map((path) => path.symbolText)).toEqual([
      buildSymbolText(ARMARIO, 1),
      buildSymbolText(ARMARIO, 2),
      buildSymbolText(ARMARIO, 3),
    ]);
    expect(paths[0].symbolText).toBe('LF1|MOV-00412|Armário de cozinha|89990|||c1');
  });

  it('desenha o simbolo como caminho fechado, com os buracos do padrao de localizacao', async () => {
    const document = await describe1({ items: [{ productId: ARMARIO.id, copies: 1 }] });
    const [path] = opsOfType(document.pages[0], 'path');

    expect(path.subpaths.length).toBeGreaterThan(3);
    expect(path.subpaths.every((points) => points.length >= 3)).toBe(true);
  });

  it('mantem o desenho do simbolo dentro da caixa da zona', async () => {
    const document = await describe1({ items: [{ productId: ARMARIO.id, copies: 1 }] });
    const geometry = computeLabelGeometry(GRANDE);
    const [path] = opsOfType(document.pages[0], 'path');
    const points = path.subpaths.flat();

    const left = Math.min(...points.map((point) => point.xMm));
    const right = Math.max(...points.map((point) => point.xMm));
    const top = Math.min(...points.map((point) => point.yMm));
    const bottom = Math.max(...points.map((point) => point.yMm));

    expect(right - left).toBeCloseTo(bottom - top, 6);
    expect(left).toBeGreaterThanOrEqual(10 + geometry.symbol.xMm);
    expect(right).toBeLessThanOrEqual(10 + geometry.symbol.xMm + geometry.symbol.sizeMm);
  });
});

describe('exemplar que nao produz simbolo', () => {
  it('sai com o marcador de falha e com o restante do conteudo', async () => {
    const symbols = new Map([[buildSymbolText(FOGAO, 1), FAILED_SYMBOL]]);

    const document = await describe1({
      items: [{ productId: FOGAO.id, copies: 1 }],
      symbols,
    });
    const [page] = document.pages;

    expect(opsOfType(page, 'path')).toHaveLength(0);
    expect(textsOf(page)).toContain('Sem símbolo');
    expect(textsOf(page)).toContain('R$ 2.199,00');
    expect(opsOfType(page, 'outline').some((op) => op.dashMm !== null)).toBe(true);
  });

  it('trata texto ausente do mapa como exemplar sem simbolo', async () => {
    const document = await describe1({
      items: [{ productId: FOGAO.id, copies: 1 }],
      symbols: new Map(),
    });

    expect(textsOf(document.pages[0])).toContain('Sem símbolo');
  });
});

describe('produto cujo texto o contrato recusa', () => {
  it('sai com o marcador de falha sem pedir simbolo nenhum', async () => {
    const longo = { ...FOGAO, systemCode: '9'.repeat(130) };
    const grid = computeSheetGrid(RETRATO, GRANDE);
    const document = describePrintDocument({
      job: { labelLayoutId: GRANDE.id, sheetLayoutId: RETRATO.id, items: [{ productId: FOGAO.id, copies: 1 }] },
      sheet: RETRATO,
      labelLayout: GRANDE,
      grid,
      products: [longo],
      symbols: new Map(),
    });

    expect(opsOfType(document.pages[0], 'path')).toHaveLength(0);
    expect(textsOf(document.pages[0])).toContain('Sem símbolo');
  });
});

describe('ordem das etiquetas', () => {
  it('mantem as copias de cada produto juntas, na ordem em que foram marcadas', async () => {
    const document = await describe1({
      items: [
        { productId: FOGAO.id, copies: 2 },
        { productId: ARMARIO.id, copies: 2 },
      ],
      labelLayout: MEDIA,
    });

    const names = textsOf(document.pages[0]).filter((text) => text.includes('BOCAS') || text.includes('COZINHA'));

    expect(names.slice(0, 2)).toEqual(['FOGÃO CINCO BOCAS', 'FOGÃO CINCO BOCAS']);
    expect(names.slice(2, 4)).toEqual(['ARMÁRIO DE COZINHA', 'ARMÁRIO DE COZINHA']);
  });
});
