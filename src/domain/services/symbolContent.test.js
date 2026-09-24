// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  SYMBOL_CONTENT_ERROR_CODES,
  SYMBOL_CONTRACT_VERSION,
  SymbolContentError,
  buildSymbolText,
  describeProductSymbolSupport,
  formatCopyId,
  parseSymbolText,
} from './symbolContent.js';

const COMPLETE = {
  systemCode: '118789',
  displayName: 'CANTINHO CAFE RUBI',
  priceInCentavos: 85990,
  ean: '7899075420416',
  ncm: '94035000',
};

const WITHOUT_OPTIONALS = {
  systemCode: '118789',
  displayName: 'CANTINHO CAFE RUBI',
  priceInCentavos: 85990,
};

function bytesOf(text) {
  return [...new TextEncoder().encode(text)];
}

describe('texto do simbolo', () => {
  it('monta o exemplo completo byte a byte', () => {
    const text = buildSymbolText(COMPLETE, 1);

    expect(text).toBe('LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1');
    expect(bytesOf(text)).toEqual(
      bytesOf('LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1'),
    );
  });

  it('monta o exemplo sem opcionais byte a byte, com as posicoes vazias mantidas', () => {
    const text = buildSymbolText(WITHOUT_OPTIONALS, 1);

    expect(text).toBe('LF1|118789|CANTINHO CAFE RUBI|85990|||c1');
    expect(bytesOf(text)).toEqual(bytesOf('LF1|118789|CANTINHO CAFE RUBI|85990|||c1'));
  });

  it('deixa vazia so a posicao do campo ausente', () => {
    expect(buildSymbolText({ ...WITHOUT_OPTIONALS, ean: '7899075420416' }, 2)).toBe(
      'LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416||c2',
    );
    expect(buildSymbolText({ ...WITHOUT_OPTIONALS, ncm: '94035000' }, 2)).toBe(
      'LF1|118789|CANTINHO CAFE RUBI|85990||94035000|c2',
    );
  });

  it('abre sempre com a versao do contrato e tem sete posicoes', () => {
    const parts = buildSymbolText(COMPLETE, 7).split('|');

    expect(SYMBOL_CONTRACT_VERSION).toBe('LF1');
    expect(parts[0]).toBe('LF1');
    expect(parts).toHaveLength(7);
  });

  it('numera c1 a cN na ordem da copia', () => {
    const copies = [1, 2, 3, 10, 120, 5000].map((copy) => buildSymbolText(COMPLETE, copy));

    expect(copies.map((text) => text.split('|')[6])).toEqual([
      'c1',
      'c2',
      'c3',
      'c10',
      'c120',
      'c5000',
    ]);
  });

  it('volta aos mesmos campos quando lido por split', () => {
    expect(parseSymbolText(buildSymbolText(WITHOUT_OPTIONALS, 4))).toEqual({
      version: 'LF1',
      systemCode: '118789',
      displayName: 'CANTINHO CAFE RUBI',
      priceInCentavos: '85990',
      ean: '',
      ncm: '',
      copy: 'c4',
    });
  });

  it('grava o nome como foi cadastrado, com acento', () => {
    expect(buildSymbolText({ ...WITHOUT_OPTIONALS, displayName: 'Sofá retrátil' }, 1)).toBe(
      'LF1|118789|Sofá retrátil|85990|||c1',
    );
  });
});

describe('separador dentro de um campo', () => {
  it('recusa a barra vertical no nome, em vez de deslocar as posicoes', () => {
    expect(() => buildSymbolText({ ...COMPLETE, displayName: 'MESA | CADEIRA' }, 1)).toThrow(
      SymbolContentError,
    );
  });

  it('recusa a quebra de linha e outros caracteres de controle', () => {
    for (const displayName of ['MESA\nCADEIRA', 'MESA\r\nCADEIRA', 'MESA\tCADEIRA']) {
      expect(() => buildSymbolText({ ...COMPLETE, displayName }, 1)).toThrow(
        expect.objectContaining({ code: SYMBOL_CONTENT_ERROR_CODES.UNSAFE_CHARACTER }),
      );
    }
  });
});

describe('recusas', () => {
  it('recusa exemplar que nao e inteiro a partir de 1', () => {
    for (const copy of [0, -1, 1.5, '1', undefined]) {
      expect(() => formatCopyId(copy)).toThrow(SymbolContentError);
    }
  });

  it('recusa produto sem codigo, sem nome ou sem preco', () => {
    expect(() => buildSymbolText({ ...COMPLETE, systemCode: '' }, 1)).toThrow(SymbolContentError);
    expect(() => buildSymbolText({ ...COMPLETE, displayName: undefined }, 1)).toThrow(
      SymbolContentError,
    );
    expect(() => buildSymbolText({ ...COMPLETE, priceInCentavos: 12.5 }, 1)).toThrow(
      SymbolContentError,
    );
  });

  it('recusa o texto acima do teto do simbolo, com o motivo escrito', () => {
    const support = describeProductSymbolSupport({ ...COMPLETE, systemCode: '9'.repeat(80) }, 1);

    expect(support.supported).toBe(false);
    expect(support.error.code).toBe(SYMBOL_CONTENT_ERROR_CODES.TOO_LONG);
    expect(support.error.message).toMatch(/limite é 122/);
  });

  it('responde pela tiragem conferindo o exemplar de numero mais alto', () => {
    // 122 bytes com c9, 123 com c10: o produto cabe ate a nona copia.
    const name = 'N'.repeat(122 - 'LF1|1|'.length - '|1|||c9'.length);
    const product = { systemCode: '1', displayName: name, priceInCentavos: 1 };

    expect(describeProductSymbolSupport(product, 9).supported).toBe(true);
    expect(describeProductSymbolSupport(product, 10).supported).toBe(false);
  });
});
