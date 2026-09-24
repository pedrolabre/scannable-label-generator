// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { BARCODE_ERROR_CODES } from './barcodeError.js';
import {
  MIN_MODULE_SIZE_MM,
  TARGET_MODULE_SIZE_MM,
  fitsMinimumModuleSize,
  minimumSymbolSizeMm,
  moduleSizeMm,
} from './barcodeSizing.js';

/** Codigo curto: 21 modulos de simbolo mais quatro de zona de silencio por lado. */
const SHORT_CODE_TOTAL_MODULES = 29;

describe('tamanho do modulo', () => {
  it('divide o lado do simbolo pela contagem de modulos', () => {
    expect(moduleSizeMm(SHORT_CODE_TOTAL_MODULES, 14.5)).toBe(0.5);
    expect(moduleSizeMm(SHORT_CODE_TOTAL_MODULES, 29)).toBe(1);
  });

  it('recusa contagem e medida invalidas em vez de devolver numero sem sentido', () => {
    expect(() => moduleSizeMm(0, 14.5)).toThrowError(
      expect.objectContaining({ code: BARCODE_ERROR_CODES.INVALID_SIZE }),
    );
    expect(() => moduleSizeMm(SHORT_CODE_TOTAL_MODULES, -1)).toThrowError(
      expect.objectContaining({ code: BARCODE_ERROR_CODES.INVALID_SIZE }),
    );
    expect(() => moduleSizeMm(SHORT_CODE_TOTAL_MODULES, Number.NaN)).toThrowError(
      expect.objectContaining({ code: BARCODE_ERROR_CODES.INVALID_SIZE }),
    );
  });
});

describe('piso de legibilidade', () => {
  it('aceita o tamanho que alcanca o modulo minimo e recusa o que fica abaixo', () => {
    expect(fitsMinimumModuleSize(SHORT_CODE_TOTAL_MODULES, 14.5)).toBe(true);
    expect(fitsMinimumModuleSize(SHORT_CODE_TOTAL_MODULES, 20)).toBe(true);
    expect(fitsMinimumModuleSize(SHORT_CODE_TOTAL_MODULES, 14)).toBe(false);
    expect(fitsMinimumModuleSize(SHORT_CODE_TOTAL_MODULES, 10)).toBe(false);
  });

  it('calcula o menor lado aceitavel do simbolo inteiro', () => {
    expect(minimumSymbolSizeMm(SHORT_CODE_TOTAL_MODULES)).toBe(14.5);
    expect(minimumSymbolSizeMm(SHORT_CODE_TOTAL_MODULES, TARGET_MODULE_SIZE_MM)).toBeCloseTo(
      17.4,
      6,
    );
  });

  it('mantem o piso e o alvo coerentes entre si', () => {
    expect(TARGET_MODULE_SIZE_MM).toBeGreaterThan(MIN_MODULE_SIZE_MM);
    expect(minimumSymbolSizeMm(SHORT_CODE_TOTAL_MODULES, TARGET_MODULE_SIZE_MM)).toBeGreaterThan(
      minimumSymbolSizeMm(SHORT_CODE_TOTAL_MODULES, MIN_MODULE_SIZE_MM),
    );
  });
});
