import { describe, expect, it } from 'vitest';

import {
  BARCODE_ERROR_CORRECTION_LEVEL,
  BARCODE_QUIET_ZONE_MODULES,
  BARCODE_SYMBOLOGY,
  MAX_ALPHANUMERIC_LENGTH,
  MAX_BYTE_LENGTH,
  MAX_NUMERIC_LENGTH,
  SYSTEM_CODE_SUPPORT_REASONS,
  canEncodeSystemCode,
  describeSystemCodeSupport,
  maxSystemCodeLength,
} from './barcodeSymbology.js';

describe('contrato da simbologia', () => {
  it('fixa a simbologia, o nivel de correcao e a zona de silencio da aplicacao', () => {
    expect(BARCODE_SYMBOLOGY).toBe('qrcode');
    expect(BARCODE_ERROR_CORRECTION_LEVEL).toBe('Q');
    expect(BARCODE_QUIET_ZONE_MODULES).toBe(4);
  });
});

describe('capacidade por modo de codificacao', () => {
  it('escolhe o limite conforme o conteudo do codigo', () => {
    expect(maxSystemCodeLength('0012345')).toBe(MAX_NUMERIC_LENGTH);
    expect(maxSystemCodeLength('ABC-123')).toBe(MAX_ALPHANUMERIC_LENGTH);
    expect(maxSystemCodeLength('abc-123')).toBe(MAX_BYTE_LENGTH);
  });

  it('derruba a capacidade quando uma unica letra minuscula aparece', () => {
    expect(maxSystemCodeLength('ABC-123')).toBeGreaterThan(maxSystemCodeLength('ABC-123a'));
  });
});

describe('resposta sobre codificabilidade, sem gerar simbolo', () => {
  it('aceita os codigos que o contrato do produto produz no dia a dia', () => {
    const codes = ['0', '0012345', 'ABC-123', 'abc-123', '7891234567890', 'PROD-2026-000123'];

    for (const code of codes) {
      expect(canEncodeSystemCode(code)).toBe(true);
    }
  });

  it('recusa o codigo vazio e o que nao e texto', () => {
    expect(describeSystemCodeSupport('')).toMatchObject({
      supported: false,
      reason: SYSTEM_CODE_SUPPORT_REASONS.EMPTY,
    });
    expect(describeSystemCodeSupport(undefined)).toMatchObject({
      supported: false,
      reason: SYSTEM_CODE_SUPPORT_REASONS.EMPTY,
    });
    expect(describeSystemCodeSupport(12345)).toMatchObject({
      supported: false,
      reason: SYSTEM_CODE_SUPPORT_REASONS.EMPTY,
    });
  });

  it('recusa caractere fora do contrato do produto', () => {
    expect(describeSystemCodeSupport('ABC 123')).toMatchObject({
      supported: false,
      reason: SYSTEM_CODE_SUPPORT_REASONS.UNSUPPORTED_CHARACTER,
    });
    expect(describeSystemCodeSupport('ABC/123')).toMatchObject({
      supported: false,
      reason: SYSTEM_CODE_SUPPORT_REASONS.UNSUPPORTED_CHARACTER,
    });
  });

  it('marca o limite exato de cada modo', () => {
    expect(canEncodeSystemCode('1'.repeat(MAX_NUMERIC_LENGTH))).toBe(true);
    expect(canEncodeSystemCode('1'.repeat(MAX_NUMERIC_LENGTH + 1))).toBe(false);
    expect(canEncodeSystemCode('A'.repeat(MAX_ALPHANUMERIC_LENGTH))).toBe(true);
    expect(canEncodeSystemCode('A'.repeat(MAX_ALPHANUMERIC_LENGTH + 1))).toBe(false);
    expect(canEncodeSystemCode('a'.repeat(MAX_BYTE_LENGTH))).toBe(true);
    expect(canEncodeSystemCode('a'.repeat(MAX_BYTE_LENGTH + 1))).toBe(false);
  });

  it('explica a recusa por comprimento com o limite daquele modo', () => {
    expect(describeSystemCodeSupport('A'.repeat(MAX_ALPHANUMERIC_LENGTH + 1))).toMatchObject({
      supported: false,
      reason: SYSTEM_CODE_SUPPORT_REASONS.TOO_LONG,
      maxLength: MAX_ALPHANUMERIC_LENGTH,
    });
  });
});
