// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { MAX_SYMBOL_TOTAL_MODULES } from '../../lib/barcodeSymbology.js';
import { MIN_MODULE_SIZE_MM } from '../../lib/barcodeSizing.js';

import {
  LABEL_ARRANGEMENTS,
  LINE_HEIGHT_RATIO,
  LabelGeometryError,
  computeLabelGeometry,
  listLabelZones,
  zoneBounds,
  zonesOverlap,
} from './labelGeometry.js';
import { LABEL_LAYOUTS, findLabelLayout } from './labelLayoutCatalog.js';

const EACH_LAYOUT = LABEL_LAYOUTS.map((layout) => [layout.id, layout]);

const BASE_LAYOUT = {
  id: 'modelo-de-prova',
  name: 'Modelo de prova',
  widthMm: 80,
  heightMm: 55,
  paddingMm: 3,
  symbolSizeMm: 27,
};

describe('zonas fixas da etiqueta', () => {
  it('ancora o simbolo no canto inferior direito da area util', () => {
    for (const layout of [BASE_LAYOUT, ...LABEL_LAYOUTS]) {
      const geometry = computeLabelGeometry(layout);
      const usable = zoneBounds(geometry.usable);
      const symbol = zoneBounds(geometry.symbol);

      expect(symbol.right).toBeCloseTo(usable.right, 10);
      expect(symbol.bottom).toBeCloseTo(usable.bottom, 10);
    }
  });

  it('na etiqueta larga, poe o codigo e a empresa no topo, em lados opostos', () => {
    const geometry = computeLabelGeometry(BASE_LAYOUT);

    expect(geometry.arrangement).toBe(LABEL_ARRANGEMENTS.WIDE);
    expect(geometry.code.xMm).toBeCloseTo(geometry.usable.xMm, 10);
    expect(geometry.code.yMm).toBeCloseTo(geometry.usable.yMm, 10);
    expect(geometry.company.yMm).toBeCloseTo(geometry.code.yMm, 10);
    expect(zoneBounds(geometry.company).right).toBeCloseTo(zoneBounds(geometry.usable).right, 10);
    expect(geometry.name.yMm).toBeGreaterThan(zoneBounds(geometry.code).bottom);
  });

  it('na etiqueta larga, ordena a area comercial e leva a linha fiscal para a base', () => {
    const geometry = computeLabelGeometry(BASE_LAYOUT);

    expect(geometry.priceLabel.yMm).toBeGreaterThanOrEqual(zoneBounds(geometry.name).bottom);
    expect(geometry.price.yMm).toBeCloseTo(zoneBounds(geometry.priceLabel).bottom, 10);
    expect(geometry.installment.yMm).toBeCloseTo(zoneBounds(geometry.price).bottom, 10);
    expect(zoneBounds(geometry.fiscal).bottom).toBeCloseTo(zoneBounds(geometry.usable).bottom, 10);
  });

  it('na etiqueta compacta, empilha tudo ao lado do simbolo e tira parcelamento e linha fiscal', () => {
    const geometry = computeLabelGeometry(findLabelLayout('etiqueta-pequena'));

    expect(geometry.arrangement).toBe(LABEL_ARRANGEMENTS.COMPACT);
    expect(geometry.installment).toBeNull();
    expect(geometry.fiscal).toBeNull();
    expect(geometry.company.yMm).toBeCloseTo(zoneBounds(geometry.code).bottom, 10);
    expect(zoneBounds(geometry.price).bottom).toBeCloseTo(zoneBounds(geometry.usable).bottom, 10);
    expect(geometry.symbol.sizeMm).toBeCloseTo(geometry.usable.heightMm, 10);
  });

  it('usa o arranjo largo na tag grande e na etiqueta media', () => {
    expect(computeLabelGeometry(findLabelLayout('tag-grande')).arrangement).toBe(
      LABEL_ARRANGEMENTS.WIDE,
    );
    expect(computeLabelGeometry(findLabelLayout('etiqueta-media')).arrangement).toBe(
      LABEL_ARRANGEMENTS.WIDE,
    );
  });
});

describe('nenhuma caixa sobrepoe outra nem sai da etiqueta', () => {
  // Prova calculada, e nao renderizada: as zonas saem das medidas do modelo,
  // entao a nao sobreposicao pode ser conferida sem montar componente nenhum.
  it.each(EACH_LAYOUT)('cabecalho, nome, area comercial, linha fiscal e simbolo em %s', (_id, layout) => {
    const geometry = computeLabelGeometry(layout);
    const zones = listLabelZones(geometry);
    const usable = zoneBounds(geometry.usable);

    for (let i = 0; i < zones.length; i += 1) {
      const bounds = zoneBounds(zones[i][1]);

      expect(bounds.left).toBeGreaterThanOrEqual(usable.left - 1e-9);
      expect(bounds.top).toBeGreaterThanOrEqual(usable.top - 1e-9);
      expect(bounds.right).toBeLessThanOrEqual(usable.right + 1e-9);
      expect(bounds.bottom).toBeLessThanOrEqual(usable.bottom + 1e-9);

      for (let j = i + 1; j < zones.length; j += 1) {
        expect(
          zonesOverlap(zones[i][1], zones[j][1]),
          `${zones[i][0]} sobrepõe ${zones[j][0]}`,
        ).toBe(false);
      }
    }
  });

  it.each(EACH_LAYOUT)('guarda o afastamento minimo entre o simbolo e o texto em %s', (_id, layout) => {
    const geometry = computeLabelGeometry(layout);
    const symbol = zoneBounds(geometry.symbol);

    expect(geometry.gapMm).toBeGreaterThanOrEqual(1.5);
    expect(symbol.left - zoneBounds(geometry.column).right).toBeCloseTo(geometry.gapMm, 10);

    for (const [, zone] of listLabelZones(geometry)) {
      if (zone === geometry.symbol) {
        continue;
      }

      const bounds = zoneBounds(zone);
      const beside = symbol.left - bounds.right >= geometry.gapMm - 1e-9;
      const above = symbol.top - bounds.bottom >= geometry.gapMm - 1e-9;

      expect(beside || above).toBe(true);
    }
  });
});

describe('recusa de modelo inviavel', () => {
  it('recusa o simbolo abaixo do piso de modulo para o maior texto aceito', () => {
    const belowFloor = MAX_SYMBOL_TOTAL_MODULES * MIN_MODULE_SIZE_MM - 0.5;

    expect(() => computeLabelGeometry({ ...BASE_LAYOUT, symbolSizeMm: belowFloor })).toThrow(
      LabelGeometryError,
    );
  });

  it('recusa a margem interna que consome a area util', () => {
    expect(() => computeLabelGeometry({ ...BASE_LAYOUT, paddingMm: 30 })).toThrow(
      LabelGeometryError,
    );
  });

  it('recusa o simbolo que nao deixa coluna ao lado', () => {
    expect(() =>
      computeLabelGeometry({ ...BASE_LAYOUT, widthMm: 30, heightMm: 60, symbolSizeMm: 27 }),
    ).toThrow(LabelGeometryError);
  });

  it('recusa a coluna compacta que nao comporta codigo, nome e preco', () => {
    const low = { ...BASE_LAYOUT, widthMm: 60, heightMm: 14, paddingMm: 0.5, symbolSizeMm: 13 };

    expect(() => computeLabelGeometry(low, 21)).toThrow(LabelGeometryError);
  });
});

describe('proporcoes derivadas das medidas', () => {
  it('nao depende do conteudo do produto, so do modelo', () => {
    expect(computeLabelGeometry(BASE_LAYOUT)).toEqual(computeLabelGeometry({ ...BASE_LAYOUT }));
  });

  it('da ao preco a maior hierarquia da etiqueta', () => {
    for (const layout of LABEL_LAYOUTS) {
      const geometry = computeLabelGeometry(layout);
      const others = listLabelZones(geometry)
        .filter(([role]) => role !== 'price' && role !== 'symbol')
        .map(([, zone]) => zone.fontSizeMm);

      expect(geometry.price.fontSizeMm).toBeGreaterThan(Math.max(...others));
    }
  });

  it('usa a mesma altura de linha em toda a etiqueta', () => {
    const geometry = computeLabelGeometry(BASE_LAYOUT);

    expect(geometry.name.lineHeightMm).toBeCloseTo(geometry.name.fontSizeMm * LINE_HEIGHT_RATIO, 10);
    expect(geometry.price.heightMm).toBeCloseTo(geometry.price.fontSizeMm * LINE_HEIGHT_RATIO, 10);
    expect(geometry.fiscal.heightMm).toBeCloseTo(geometry.fiscal.fontSizeMm * LINE_HEIGHT_RATIO, 10);
  });
});
