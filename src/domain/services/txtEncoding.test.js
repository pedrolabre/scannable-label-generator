// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { decodeReportBytes } from './txtEncoding.js';

/**
 * Bytes do arquivo a partir de um texto escrito com escapes: cada caractere de
 * `\x00` a `\xFF` vira o byte de mesmo numero, que e como o relatorio chega.
 */
function bytesOf(text) {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

const CP850_BYTES = [
  [0x80, 'Ç'],
  [0x81, 'ü'],
  [0x82, 'é'],
  [0x83, 'â'],
  [0x84, 'ä'],
  [0x85, 'à'],
  [0x86, 'å'],
  [0x87, 'ç'],
  [0x88, 'ê'],
  [0x89, 'ë'],
  [0x8a, 'è'],
  [0x8b, 'ï'],
  [0x8c, 'î'],
  [0x8d, 'ì'],
  [0x8e, 'Ä'],
  [0x8f, 'Å'],
  [0x90, 'É'],
  [0x91, 'æ'],
  [0x92, 'Æ'],
  [0x93, 'ô'],
  [0x94, 'ö'],
  [0x95, 'ò'],
  [0x96, 'û'],
  [0x97, 'ù'],
  [0x98, 'ÿ'],
  [0x99, 'Ö'],
  [0x9a, 'Ü'],
  [0x9b, 'ø'],
  [0x9c, '£'],
  [0x9d, 'Ø'],
  [0x9e, '×'],
  [0x9f, 'ƒ'],
  [0xa7, 'º'],
  [0xd6, 'Í'],
  [0xf8, '°'],
];

const LATIN1_BYTES = [
  [0xba, 'º'],
  [0xc1, 'Á'],
  [0xc2, 'Â'],
  [0xc3, 'Ã'],
  [0xc7, 'Ç'],
  [0xc9, 'É'],
  [0xd3, 'Ó'],
  [0xd4, 'Ô'],
  [0xe1, 'á'],
  [0xe2, 'â'],
  [0xe3, 'ã'],
  [0xe7, 'ç'],
  [0xe9, 'é'],
  [0xf3, 'ó'],
  [0xfa, 'ú'],
];

describe('decodeReportBytes', () => {
  it.each(CP850_BYTES)('le o byte %i pela pagina 850 como %s', (byte, expected) => {
    expect(decodeReportBytes(new Uint8Array([byte]))).toBe(expected);
  });

  it.each(LATIN1_BYTES)('le o byte %i em Latin-1 como %s', (byte, expected) => {
    expect(decodeReportBytes(new Uint8Array([byte]))).toBe(expected);
  });

  it('le em Latin-1 todo byte alto que nao e da pagina 850', () => {
    const cp850 = new Set(CP850_BYTES.map(([byte]) => byte));

    for (let byte = 0xa0; byte <= 0xff; byte += 1) {
      if (!cp850.has(byte)) {
        expect(decodeReportBytes(new Uint8Array([byte]))).toBe(String.fromCharCode(byte));
      }
    }
  });

  it('mantem o ASCII intacto', () => {
    const ascii = Array.from({ length: 128 }, (_, byte) => String.fromCharCode(byte)).join('');

    expect(decodeReportBytes(bytesOf(ascii))).toBe(ascii);
  });

  it('le o cabecalho do relatorio', () => {
    expect(decodeReportBytes(bytesOf('|Pre\xe7o R$ |'))).toBe('|Preço R$ |');
  });

  it('acentua as duas codificacoes misturadas no mesmo texto', () => {
    const text = decodeReportBytes(
      bytesOf(
        'ARMARIO A\x80O|CAL\x80A FEM|VOLLEY M\x90DIO|N\xa7 12|LET\xd6CIA|BALC\xc3O TRIPLO|Fog\xe3o a g\xe1s',
      ),
    );

    expect(text).toBe('ARMARIO AÇO|CALÇA FEM|VOLLEY MÉDIO|Nº 12|LETÍCIA|BALCÃO TRIPLO|Fogão a gás');
    expect(text).not.toMatch(/[€�\u0080-\u009F]/);
  });

  it('aceita o conteudo em ArrayBuffer', () => {
    expect(decodeReportBytes(bytesOf('A\x80O').buffer)).toBe('AÇO');
  });

  it('le um arquivo maior que uma fatia sem perder nem trocar caractere', () => {
    const text = 'CAL\x80A '.repeat(5000);
    const decoded = decodeReportBytes(bytesOf(text));

    expect(decoded).toHaveLength(text.length);
    expect(decoded).toBe('CALÇA '.repeat(5000));
  });
});
