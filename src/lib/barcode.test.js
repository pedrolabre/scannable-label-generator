// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest';

import { ProductSchema } from '../domain/schemas/productSchema.js';
import { buildSymbolText } from '../domain/services/symbolContent.js';
import { generateProductSymbol, generateSymbol } from './barcode.js';
import { clearBarcodeCache } from './barcodeCache.js';
import { BARCODE_ERROR_CODES } from './barcodeError.js';
import { readSvgViewBox } from './barcodeSvg.js';
import {
  MAX_SYMBOL_TEXT_BYTES,
  MAX_SYMBOL_TOTAL_MODULES,
  MAX_UTF8_SYMBOL_TEXT_BYTES,
} from './barcodeSymbology.js';

const BASE_PRODUCT = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  systemCode: '118789',
  displayName: 'CANTINHO CAFE RUBI',
  description: 'Cantinho de café em MDF',
  priceInCentavos: 85990,
  ean: '7899075420416',
  ncm: '94035000',
  category: 'Móveis',
  notes: 'Exposição na vitrine da frente',
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
};

const TYPICAL_TEXT = 'LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1';

function productFrom(overrides) {
  return ProductSchema.parse({ ...BASE_PRODUCT, ...overrides });
}

beforeEach(() => {
  clearBarcodeCache();
});

describe('conteudo do simbolo', () => {
  it('grava o texto do exemplar montado pelo contrato', async () => {
    const product = productFrom({});
    const symbol = await generateProductSymbol(product, 1);

    expect(symbol.text).toBe(TYPICAL_TEXT);
    expect(symbol.text).toBe(buildSymbolText(product, 1));
  });

  it('usa o exemplar 1 quando a copia nao e informada', async () => {
    expect((await generateProductSymbol(productFrom({}))).text).toMatch(/\|c1$/);
  });

  it('desenha um simbolo diferente para cada exemplar do mesmo produto', async () => {
    const product = productFrom({});
    const drawings = new Set();

    for (let copy = 1; copy <= 5; copy += 1) {
      drawings.add((await generateProductSymbol(product, copy)).svg);
    }

    expect(drawings.size).toBe(5);
  });

  it('muda o desenho quando qualquer campo gravado muda', async () => {
    const original = await generateProductSymbol(productFrom({}), 1);
    const priceChanged = await generateProductSymbol(productFrom({ priceInCentavos: 85991 }), 1);
    const ncmChanged = await generateProductSymbol(productFrom({ ncm: '94035001' }), 1);

    expect(priceChanged.svg).not.toBe(original.svg);
    expect(ncmChanged.svg).not.toBe(original.svg);
  });

  it('gera o texto tipico no nivel M, na versao 4', async () => {
    const symbol = await generateSymbol(TYPICAL_TEXT);

    expect(symbol.errorCorrectionLevel).toBe('M');
    expect(symbol.moduleCount).toBe(33);
    expect(symbol.totalModules).toBe(41);
  });

  it('declara UTF-8 so no texto com acento', async () => {
    const plain = await generateSymbol('LF1|1|SOFA|1|||c1');
    const accented = await generateSymbol('LF1|1|SOFÁ|1|||c1');

    expect(plain.text).toBe('LF1|1|SOFA|1|||c1');
    expect(accented.text).toBe('LF1|1|SOFÁ|1|||c1');
    expect(accented.svg).not.toBe(plain.svg);
  });
});

describe('pior caso aceito', () => {
  // Os dois textos no teto sao os mais caros do arquivo. A suite monta um
  // ambiente por arquivo e executa os arquivos em paralelo; o limite proprio
  // faz a prova medir o desenho, e nao a carga da maquina.
  it('nao passa da versao 7 no teto do texto sem acento', async () => {
    const text = `LF1|${'9'.repeat(20)}|${'X Y1'.repeat(40)}`.slice(0, MAX_SYMBOL_TEXT_BYTES);
    const symbol = await generateSymbol(text);

    expect(symbol.totalModules).toBeLessThanOrEqual(MAX_SYMBOL_TOTAL_MODULES);
  }, 30_000);

  it('nao passa da versao 7 no teto do texto com acento', async () => {
    const text = 'Á'.repeat(MAX_UTF8_SYMBOL_TEXT_BYTES / 2 - 0.5) + 'A';
    const symbol = await generateSymbol(text);

    expect(new TextEncoder().encode(text).length).toBe(MAX_UTF8_SYMBOL_TEXT_BYTES);
    expect(symbol.totalModules).toBeLessThanOrEqual(MAX_SYMBOL_TOTAL_MODULES);
  }, 30_000);

  it('nao passa da versao 7 com o nome de 60 caracteres acentuado e todos os campos', async () => {
    const product = productFrom({
      systemCode: '118789',
      displayName: 'SOFÁ RETRÁTIL RECLINÁVEL 3 LUGARES SUEDE CINZA COM BAÚ 2,10M',
      priceInCentavos: 999999,
      ean: '17899075420416',
    });
    const symbol = await generateProductSymbol(product, 5000);

    expect(product.displayName).toHaveLength(60);
    expect(symbol.totalModules).toBeLessThanOrEqual(MAX_SYMBOL_TOTAL_MODULES);
  }, 30_000);
});

describe('proporcao do simbolo', () => {
  const texts = ['1', TYPICAL_TEXT, 'LF1|1|SOFÁ|1|||c1', 'A'.repeat(MAX_SYMBOL_TEXT_BYTES)];

  it('sai sempre quadrado, para textos de comprimentos diferentes', async () => {
    for (const text of texts) {
      const viewBox = readSvgViewBox((await generateSymbol(text)).svg);

      expect(viewBox.width).toBe(viewBox.height);
      expect(viewBox.width).toBeGreaterThan(0);
    }
  });

  it('descreve o simbolo sem unidade e sem dimensao fixa', async () => {
    for (const text of texts) {
      const symbol = await generateSymbol(text);

      expect(symbol.svg).toMatch(/preserveAspectRatio="xMidYMid meet"/);
      expect(symbol.svg).not.toMatch(/<svg\b[^>]*\swidth=/);
      expect(symbol.svg).not.toMatch(/<svg\b[^>]*\sheight=/);
    }
  });

  it('reporta contagem de modulos coerente com a caixa desenhada', async () => {
    const symbol = await generateSymbol(TYPICAL_TEXT);
    const viewBox = readSvgViewBox(symbol.svg);

    expect(symbol.quietZoneModules).toBe(4);
    expect(symbol.totalModules).toBe(symbol.moduleCount + symbol.quietZoneModules * 2);
    expect(viewBox.width).toBe(symbol.totalModules * 2);
  });

  it('embute a zona de silencio com fundo branco explicito', async () => {
    const symbol = await generateSymbol(TYPICAL_TEXT);

    expect(symbol.svg).toMatch(/fill="#FFFFFF"/);
  });
});

describe('texto que nao pode ser codificado', () => {
  it('recusa com motivo proprio o texto acima do teto', async () => {
    await expect(generateSymbol('A'.repeat(MAX_SYMBOL_TEXT_BYTES + 1))).rejects.toMatchObject({
      name: 'BarcodeError',
      code: BARCODE_ERROR_CODES.CODE_TOO_LONG,
    });
  });

  it('recusa o texto vazio', async () => {
    await expect(generateSymbol('')).rejects.toMatchObject({
      code: BARCODE_ERROR_CODES.EMPTY_CODE,
    });
  });

  it('traduz a recusa do contrato do texto para a falha do motor', async () => {
    await expect(generateProductSymbol({ ...BASE_PRODUCT, displayName: 'A|B' })).rejects.toMatchObject({
      name: 'BarcodeError',
      code: BARCODE_ERROR_CODES.UNSUPPORTED_CHARACTER,
    });
    await expect(generateProductSymbol({ ...BASE_PRODUCT, systemCode: '' })).rejects.toMatchObject({
      code: BARCODE_ERROR_CODES.EMPTY_CODE,
    });
    await expect(
      generateProductSymbol({ ...BASE_PRODUCT, systemCode: '9'.repeat(200) }),
    ).rejects.toMatchObject({ code: BARCODE_ERROR_CODES.CODE_TOO_LONG });
  });
});
