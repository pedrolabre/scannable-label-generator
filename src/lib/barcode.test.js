// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest';

import { ProductSchema } from '../domain/schemas/productSchema.js';
import { generateProductSymbol, generateSymbol } from './barcode.js';
import { clearBarcodeCache } from './barcodeCache.js';
import { BARCODE_ERROR_CODES } from './barcodeError.js';
import { readSvgViewBox } from './barcodeSvg.js';
import { MAX_ALPHANUMERIC_LENGTH } from './barcodeSymbology.js';

const BASE_PRODUCT = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  systemCode: '0012345',
  displayName: 'Geladeira frost free 420 litros',
  description: 'Modelo de duas portas com painel eletrônico',
  priceInCentavos: 389900,
  ean: '7891234567895',
  category: 'Eletrodomésticos',
  notes: 'Exposição na vitrine da frente',
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
};

function productFrom(overrides) {
  return ProductSchema.parse({ ...BASE_PRODUCT, ...overrides });
}

beforeEach(() => {
  clearBarcodeCache();
});

describe('conteudo do simbolo', () => {
  it('codifica o codigo do sistema e nenhum outro campo do produto', async () => {
    const first = productFrom({});
    const second = productFrom({
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      displayName: 'Fogão cinco bocas com forno elétrico',
      description: undefined,
      priceInCentavos: 1,
      ean: '12345678',
      category: undefined,
      notes: undefined,
      createdAt: '2020-05-01T08:30:00.000Z',
      updatedAt: '2031-12-31T23:59:59.000Z',
    });

    expect(second.systemCode).toBe(first.systemCode);
    expect(second.displayName).not.toBe(first.displayName);

    clearBarcodeCache();
    const fromFirst = await generateProductSymbol(first);
    clearBarcodeCache();
    const fromSecond = await generateProductSymbol(second);

    expect(fromSecond.svg).toBe(fromFirst.svg);
    expect(fromSecond.moduleCount).toBe(fromFirst.moduleCount);
  });

  it('muda o desenho quando um unico caractere do codigo muda', async () => {
    const original = await generateSymbol('0012345');
    const changed = await generateSymbol('0012346');

    expect(changed.svg).not.toBe(original.svg);
  });

  it('nao repete o mesmo desenho para codigos diferentes', async () => {
    const codes = ['0012345', '0012346', 'ABC-123', 'abc-123', 'A', '1', 'PROD-2026-000123'];
    const drawings = new Set();

    for (const code of codes) {
      const symbol = await generateSymbol(code);
      drawings.add(symbol.svg);
    }

    expect(drawings.size).toBe(codes.length);
  });

  it('fica na menor versao possivel, entao carga extra apareceria na contagem de modulos', async () => {
    const bareCode = await generateSymbol('0012345');
    const prefixedCode = await generateSymbol('LABELFORGE-PRODUTO-0012345-BR');

    expect(bareCode.moduleCount).toBe(21);
    expect(prefixedCode.moduleCount).toBeGreaterThan(bareCode.moduleCount);
  });
});

describe('proporcao do simbolo', () => {
  const codes = ['1', '12', '0012345', 'ABC-123', 'abc-123', 'PROD-2026-000123', 'A'.repeat(60)];

  it('sai sempre quadrado, para codigos de comprimentos diferentes', async () => {
    for (const code of codes) {
      const viewBox = readSvgViewBox((await generateSymbol(code)).svg);

      expect(viewBox.width).toBe(viewBox.height);
      expect(viewBox.width).toBeGreaterThan(0);
    }
  });

  it('descreve o simbolo sem unidade e sem dimensao fixa', async () => {
    for (const code of codes) {
      const symbol = await generateSymbol(code);

      expect(symbol.svg).toMatch(/preserveAspectRatio="xMidYMid meet"/);
      expect(symbol.svg).not.toMatch(/<svg\b[^>]*\swidth=/);
      expect(symbol.svg).not.toMatch(/<svg\b[^>]*\sheight=/);
    }
  });

  it('reporta contagem de modulos coerente com a caixa desenhada', async () => {
    const symbol = await generateSymbol('0012345');
    const viewBox = readSvgViewBox(symbol.svg);

    expect(symbol.quietZoneModules).toBe(4);
    expect(symbol.totalModules).toBe(symbol.moduleCount + symbol.quietZoneModules * 2);
    expect(viewBox.width).toBe(symbol.totalModules * 2);
  });

  it('embute a zona de silencio com fundo branco explicito', async () => {
    const symbol = await generateSymbol('0012345');

    expect(symbol.svg).toMatch(/fill="#FFFFFF"/);
  });
});

describe('extremos aceitos pelo contrato do produto', () => {
  it('gera o simbolo do codigo mais curto que o contrato aceita', async () => {
    const product = productFrom({ systemCode: '0' });
    const symbol = await generateProductSymbol(product);

    expect(product.systemCode).toHaveLength(1);
    expect(symbol.moduleCount).toBe(21);
  });

  // O simbolo de capacidade maxima e o desenho mais caro do arquivo: 177 modulos
  // por lado, contra 21 do menor. Sozinho ele leva cerca de um segundo, mas a
  // suite monta um ambiente por arquivo e executa os arquivos em paralelo, e sob
  // essa disputa o mesmo desenho passa do limite padrao. O limite proprio faz a
  // prova medir o desenho, e nao a carga da maquina que o executa.
  it('gera o simbolo de um codigo longo, ja que o contrato do produto nao tem teto', async () => {
    const product = productFrom({ systemCode: 'A'.repeat(MAX_ALPHANUMERIC_LENGTH) });
    const symbol = await generateProductSymbol(product);
    const viewBox = readSvgViewBox(symbol.svg);

    expect(product.systemCode).toHaveLength(MAX_ALPHANUMERIC_LENGTH);
    expect(symbol.moduleCount).toBe(177);
    expect(viewBox.width).toBe(viewBox.height);
  }, 30_000);
});

describe('codigo que nao pode ser codificado', () => {
  it('recusa com motivo proprio quando o codigo passa da capacidade do simbolo', async () => {
    await expect(generateSymbol('A'.repeat(MAX_ALPHANUMERIC_LENGTH + 1))).rejects.toMatchObject({
      name: 'BarcodeError',
      code: BARCODE_ERROR_CODES.CODE_TOO_LONG,
    });
  });

  it('aceita no contrato do produto o codigo que o simbolo recusa', () => {
    const product = productFrom({ systemCode: 'A'.repeat(MAX_ALPHANUMERIC_LENGTH + 1) });

    expect(product.systemCode).toHaveLength(MAX_ALPHANUMERIC_LENGTH + 1);
  });

  it('recusa o codigo vazio e o caractere fora do contrato', async () => {
    await expect(generateSymbol('')).rejects.toMatchObject({
      code: BARCODE_ERROR_CODES.EMPTY_CODE,
    });
    await expect(generateSymbol('ABC 123')).rejects.toMatchObject({
      code: BARCODE_ERROR_CODES.UNSUPPORTED_CHARACTER,
    });
  });
});
