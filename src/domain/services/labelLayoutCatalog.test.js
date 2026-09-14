// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  MIN_MODULE_SIZE_MM,
  TARGET_MODULE_SIZE_MM,
  fitsMinimumModuleSize,
  minimumSymbolSizeMm,
  moduleSizeMm,
} from '../../lib/barcodeSizing.js';
import { LabelLayoutSchema } from '../schemas/labelLayoutSchema.js';

import { NOMINAL_TOTAL_MODULES, computeLabelGeometry } from './labelGeometry.js';
import {
  DEFAULT_LABEL_LAYOUT_ID,
  LABEL_LAYOUTS,
  findLabelLayout,
  getDefaultLabelLayout,
  listLabelLayouts,
} from './labelLayoutCatalog.js';

describe('catalogo de modelos', () => {
  it('entrega mais de um modelo, com identificadores distintos', () => {
    expect(LABEL_LAYOUTS.length).toBeGreaterThan(1);
    expect(new Set(LABEL_LAYOUTS.map((layout) => layout.id)).size).toBe(LABEL_LAYOUTS.length);
  });

  it('inclui um modelo grande o bastante para movel e eletrodomestico', () => {
    const largest = [...LABEL_LAYOUTS].sort(
      (a, b) => b.widthMm * b.heightMm - a.widthMm * a.heightMm,
    )[0];

    expect(largest.widthMm).toBeGreaterThanOrEqual(90);
    expect(largest.heightMm).toBeGreaterThanOrEqual(60);
  });

  it('todo modelo passa pelo contrato do modelo de etiqueta', () => {
    for (const layout of LABEL_LAYOUTS) {
      expect(LabelLayoutSchema.safeParse(layout).success).toBe(true);
    }
  });

  it('o padrao existe e esta no catalogo', () => {
    expect(findLabelLayout(DEFAULT_LABEL_LAYOUT_ID)).not.toBeNull();
    expect(getDefaultLabelLayout().id).toBe(DEFAULT_LABEL_LAYOUT_ID);
    expect(listLabelLayouts()).toBe(LABEL_LAYOUTS);
    expect(findLabelLayout('modelo-que-nao-existe')).toBeNull();
  });

  it('nao permite alteracao do catalogo em tempo de execucao', () => {
    expect(Object.isFrozen(LABEL_LAYOUTS)).toBe(true);
    expect(LABEL_LAYOUTS.every((layout) => Object.isFrozen(layout))).toBe(true);
  });
});

describe('piso de legibilidade do simbolo', () => {
  it.each(LABEL_LAYOUTS.map((layout) => [layout.id, layout]))(
    '%s alcanca o piso de modulo, e tambem o alvo',
    (_id, layout) => {
      expect(fitsMinimumModuleSize(NOMINAL_TOTAL_MODULES, layout.symbolSizeMm)).toBe(true);

      const side = moduleSizeMm(NOMINAL_TOTAL_MODULES, layout.symbolSizeMm);

      expect(side).toBeGreaterThanOrEqual(MIN_MODULE_SIZE_MM);
      expect(side).toBeGreaterThanOrEqual(TARGET_MODULE_SIZE_MM);
    },
  );

  it('o piso corresponde ao lado minimo que o simbolo inteiro pode ter', () => {
    expect(minimumSymbolSizeMm(NOMINAL_TOTAL_MODULES)).toBeCloseTo(
      NOMINAL_TOTAL_MODULES * MIN_MODULE_SIZE_MM,
      10,
    );

    for (const layout of LABEL_LAYOUTS) {
      expect(layout.symbolSizeMm).toBeGreaterThanOrEqual(
        minimumSymbolSizeMm(NOMINAL_TOTAL_MODULES),
      );
    }
  });

  it('a recusa acontece para o modelo que fica abaixo do piso', () => {
    const tooSmall = {
      id: 'modelo-ilegivel',
      name: 'Modelo ilegível',
      widthMm: 40,
      heightMm: 28,
      paddingMm: 2,
      symbolSizeMm: minimumSymbolSizeMm(NOMINAL_TOTAL_MODULES) - 0.1,
    };

    expect(LabelLayoutSchema.safeParse(tooSmall).success).toBe(true);
    expect(() => computeLabelGeometry(tooSmall)).toThrow(
      /tamanho minimo de modulo|abaixo do tamanho/i,
    );
  });
});

describe('viabilidade geometrica de cada modelo', () => {
  it.each(LABEL_LAYOUTS.map((layout) => [layout.id, layout]))(
    '%s comporta o contrato visual inteiro',
    (_id, layout) => {
      const geometry = computeLabelGeometry(layout);

      expect(geometry.column.widthMm).toBeGreaterThan(0);
      expect(geometry.name.lines).toBeGreaterThanOrEqual(1);
      expect(geometry.symbol.sizeMm).toBe(layout.symbolSizeMm);
    },
  );
});
