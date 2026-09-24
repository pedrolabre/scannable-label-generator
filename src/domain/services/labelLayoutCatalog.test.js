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

import { MAX_SYMBOL_TOTAL_MODULES } from '../../lib/barcodeSymbology.js';

import { computeLabelGeometry } from './labelGeometry.js';
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

  it('o padrao e a etiqueta de 10 por folha, primeira da lista', () => {
    expect(DEFAULT_LABEL_LAYOUT_ID).toBe('etiqueta-media-10');
    expect(LABEL_LAYOUTS[0].id).toBe(DEFAULT_LABEL_LAYOUT_ID);
    expect(getDefaultLabelLayout()).toEqual({
      id: 'etiqueta-media-10',
      name: 'Etiqueta 10 (84,7 x 46,6 mm)',
      widthMm: 84.7,
      heightMm: 46.6,
      paddingMm: 2.5,
      symbolSizeMm: 27,
    });
  });

  it('mantem os tres modelos anteriores como estavam', () => {
    expect(findLabelLayout('tag-grande')).toMatchObject({
      widthMm: 100,
      heightMm: 70,
      paddingMm: 4,
      symbolSizeMm: 32,
    });
    expect(findLabelLayout('etiqueta-media')).toMatchObject({
      widthMm: 70,
      heightMm: 50,
      paddingMm: 3,
      symbolSizeMm: 27,
    });
    expect(findLabelLayout('etiqueta-pequena')).toMatchObject({
      widthMm: 50,
      heightMm: 30,
      paddingMm: 1.5,
      symbolSizeMm: 27,
    });
  });

  it('nao permite alteracao do catalogo em tempo de execucao', () => {
    expect(Object.isFrozen(LABEL_LAYOUTS)).toBe(true);
    expect(LABEL_LAYOUTS.every((layout) => Object.isFrozen(layout))).toBe(true);
  });
});

describe('piso de legibilidade do simbolo', () => {
  // O texto tipico do simbolo tem 61 bytes e cai na versao 4: 41 modulos com a
  // zona de silencio. O maior texto aceito cai na versao 7: 53 modulos.
  const TYPICAL_TOTAL_MODULES = 41;

  it.each(LABEL_LAYOUTS.map((layout) => [layout.id, layout]))(
    '%s fica acima do piso no pior caso, e acima do alvo no caso tipico',
    (_id, layout) => {
      expect(fitsMinimumModuleSize(MAX_SYMBOL_TOTAL_MODULES, layout.symbolSizeMm)).toBe(true);
      expect(moduleSizeMm(MAX_SYMBOL_TOTAL_MODULES, layout.symbolSizeMm)).toBeGreaterThanOrEqual(
        MIN_MODULE_SIZE_MM,
      );
      expect(moduleSizeMm(TYPICAL_TOTAL_MODULES, layout.symbolSizeMm)).toBeGreaterThanOrEqual(
        TARGET_MODULE_SIZE_MM,
      );
    },
  );

  it('a etiqueta de 10 por folha fica acima do piso no pior caso', () => {
    const padrao = getDefaultLabelLayout();

    // 27 mm para 53 modulos: 0,509 mm por modulo.
    expect(moduleSizeMm(MAX_SYMBOL_TOTAL_MODULES, padrao.symbolSizeMm)).toBeGreaterThan(
      MIN_MODULE_SIZE_MM,
    );
    expect(computeLabelGeometry(padrao).symbol.moduleSizeMm).toBeCloseTo(27 / 53, 10);
  });

  it('a tag grande alcanca o alvo mesmo no pior caso', () => {
    const grande = findLabelLayout('tag-grande');

    expect(moduleSizeMm(MAX_SYMBOL_TOTAL_MODULES, grande.symbolSizeMm)).toBeGreaterThanOrEqual(
      TARGET_MODULE_SIZE_MM,
    );
  });

  it('o piso corresponde ao lado minimo que o simbolo inteiro pode ter', () => {
    expect(minimumSymbolSizeMm(MAX_SYMBOL_TOTAL_MODULES)).toBeCloseTo(
      MAX_SYMBOL_TOTAL_MODULES * MIN_MODULE_SIZE_MM,
      10,
    );

    for (const layout of LABEL_LAYOUTS) {
      expect(layout.symbolSizeMm).toBeGreaterThanOrEqual(
        minimumSymbolSizeMm(MAX_SYMBOL_TOTAL_MODULES),
      );
    }
  });

  it('a recusa acontece para o modelo que fica abaixo do piso', () => {
    const tooSmall = {
      id: 'modelo-ilegivel',
      name: 'Modelo ilegível',
      widthMm: 60,
      heightMm: 40,
      paddingMm: 2,
      symbolSizeMm: minimumSymbolSizeMm(MAX_SYMBOL_TOTAL_MODULES) - 0.1,
    };

    expect(LabelLayoutSchema.safeParse(tooSmall).success).toBe(true);
    expect(() => computeLabelGeometry(tooSmall)).toThrow(/tamanho mínimo de módulo/i);
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
      expect(geometry.symbol.totalModules).toBe(MAX_SYMBOL_TOTAL_MODULES);
    },
  );
});
