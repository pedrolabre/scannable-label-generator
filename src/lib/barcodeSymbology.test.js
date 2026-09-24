// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  BARCODE_ERROR_CORRECTION_LEVEL,
  BARCODE_QUIET_ZONE_MODULES,
  BARCODE_SYMBOLOGY,
  MAX_SYMBOL_TEXT_BYTES,
  MAX_SYMBOL_TOTAL_MODULES,
  MAX_UTF8_SYMBOL_TEXT_BYTES,
  SYMBOL_TEXT_SUPPORT_REASONS,
  canEncodeSymbolText,
  describeSymbolTextSupport,
  needsUtf8Declaration,
  symbolTextByteLength,
} from './barcodeSymbology.js';

describe('contrato da simbologia', () => {
  it('fixa a simbologia, o nivel de correcao M e a zona de silencio de 4 modulos', () => {
    expect(BARCODE_SYMBOLOGY).toBe('qrcode');
    expect(BARCODE_ERROR_CORRECTION_LEVEL).toBe('M');
    expect(BARCODE_QUIET_ZONE_MODULES).toBe(4);
  });

  it('dimensiona o maior simbolo aceito pela versao 7 com a zona de silencio', () => {
    expect(MAX_SYMBOL_TOTAL_MODULES).toBe(53);
  });
});

describe('tamanho do texto', () => {
  it('conta bytes em UTF-8, e nao caracteres', () => {
    expect(symbolTextByteLength('SOFA')).toBe(4);
    expect(symbolTextByteLength('SOFÁ')).toBe(5);
  });

  it('pede a declaracao de UTF-8 so quando ha caractere fora do ASCII', () => {
    expect(needsUtf8Declaration('LF1|118789|CANTINHO CAFE RUBI|85990|||c1')).toBe(false);
    expect(needsUtf8Declaration('LF1|118789|SOFÁ|85990|||c1')).toBe(true);
  });

  it('aceita ate o teto de cada caso e recusa um byte alem', () => {
    expect(canEncodeSymbolText('A'.repeat(MAX_SYMBOL_TEXT_BYTES))).toBe(true);
    expect(canEncodeSymbolText('A'.repeat(MAX_SYMBOL_TEXT_BYTES + 1))).toBe(false);

    const accented = `Á${'A'.repeat(MAX_UTF8_SYMBOL_TEXT_BYTES - 2)}`;

    expect(symbolTextByteLength(accented)).toBe(MAX_UTF8_SYMBOL_TEXT_BYTES);
    expect(canEncodeSymbolText(accented)).toBe(true);
    expect(canEncodeSymbolText(`${accented}A`)).toBe(false);
  });

  it('explica a recusa com o tamanho e o teto', () => {
    expect(describeSymbolTextSupport('A'.repeat(130))).toEqual({
      supported: false,
      reason: SYMBOL_TEXT_SUPPORT_REASONS.TOO_LONG,
      byteLength: 130,
      maxBytes: MAX_SYMBOL_TEXT_BYTES,
    });
  });

  it('recusa o texto vazio e o que nao e texto', () => {
    expect(describeSymbolTextSupport('')).toMatchObject({
      supported: false,
      reason: SYMBOL_TEXT_SUPPORT_REASONS.EMPTY,
    });
    expect(describeSymbolTextSupport(undefined)).toMatchObject({
      supported: false,
      reason: SYMBOL_TEXT_SUPPORT_REASONS.EMPTY,
    });
    expect(describeSymbolTextSupport(12345)).toMatchObject({
      supported: false,
      reason: SYMBOL_TEXT_SUPPORT_REASONS.EMPTY,
    });
  });
});
