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
    expect(geometry.card.yMm).toBeCloseTo(zoneBounds(geometry.price).bottom, 10);
    expect(zoneBounds(geometry.fiscal).bottom).toBeCloseTo(zoneBounds(geometry.usable).bottom, 10);
  });

  it('na etiqueta compacta, empilha tudo ao lado do simbolo e tira cartao e linha fiscal', () => {
    const geometry = computeLabelGeometry(findLabelLayout('etiqueta-pequena'));

    expect(geometry.arrangement).toBe(LABEL_ARRANGEMENTS.COMPACT);
    expect(geometry.card).toBeNull();
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

describe('zona do logotipo', () => {
  const WIDE_LAYOUTS = EACH_LAYOUT.filter(
    ([, layout]) => computeLabelGeometry(layout).arrangement === LABEL_ARRANGEMENTS.WIDE,
  );

  it.each(WIDE_LAYOUTS)('toma o lugar da empresa no cabecalho em %s', (_id, layout) => {
    const geometry = computeLabelGeometry(layout);

    expect(geometry.logo).toEqual({
      xMm: geometry.company.xMm,
      yMm: geometry.header.yMm,
      widthMm: geometry.company.widthMm,
      heightMm: geometry.header.heightMm,
    });
    expect(Object.isFrozen(geometry.logo)).toBe(true);
  });

  it.each(WIDE_LAYOUTS)('fica na area util e nao toca nenhuma outra zona em %s', (_id, layout) => {
    const geometry = computeLabelGeometry(layout);
    const logo = zoneBounds(geometry.logo);
    const usable = zoneBounds(geometry.usable);

    expect(logo.left).toBeGreaterThanOrEqual(usable.left - 1e-9);
    expect(logo.top).toBeGreaterThanOrEqual(usable.top - 1e-9);
    expect(logo.right).toBeLessThanOrEqual(usable.right + 1e-9);

    // A empresa e a zona que o logotipo substitui; todas as outras ficam livres.
    for (const [role, zone] of listLabelZones(geometry).filter(([name]) => name !== 'company')) {
      expect(zonesOverlap(geometry.logo, zone), `logo sobrepõe ${role}`).toBe(false);
    }

    const symbol = zoneBounds(geometry.symbol);

    expect(symbol.top - logo.bottom).toBeGreaterThanOrEqual(geometry.gapMm - 1e-9);
  });

  it('nao existe no arranjo compacto', () => {
    const geometry = computeLabelGeometry(findLabelLayout('etiqueta-pequena'));

    expect(geometry.arrangement).toBe(LABEL_ARRANGEMENTS.COMPACT);
    expect(geometry.logo).toBeNull();
  });

  it('deixa o simbolo de cada modelo no mesmo lugar e do mesmo lado', () => {
    const expected = {
      'etiqueta-media-10': [55.2, 17.1, 27],
      'tag-grande': [64, 34, 32],
      'etiqueta-media': [40, 20, 27],
      'etiqueta-pequena': [21.5, 1.5, 27],
    };

    for (const layout of LABEL_LAYOUTS) {
      const { symbol } = computeLabelGeometry(layout);
      const [xMm, yMm, sizeMm] = expected[layout.id];

      expect(symbol.xMm).toBeCloseTo(xMm, 6);
      expect(symbol.yMm).toBeCloseTo(yMm, 6);
      expect(symbol.sizeMm).toBe(sizeMm);
    }
  });

  it('deixa a etiqueta pequena, que nao leva logotipo, com as zonas de antes', () => {
    // Medidas lidas antes do logotipo existir: x, y, largura e altura, em mm.
    const geometry = computeLabelGeometry(findLabelLayout('etiqueta-pequena'));
    const round = (n) => Math.round(n * 100) / 100;
    const measured = Object.fromEntries(
      listLabelZones(geometry).map(([role, zone]) => [
        role,
        [zone.xMm, zone.yMm, zone.widthMm ?? zone.sizeMm, zone.heightMm ?? zone.sizeMm].map(round),
      ]),
    );

    expect(measured).toEqual({
      code: [1.5, 1.5, 18.5, 2.97],
      company: [1.5, 4.47, 18.5, 1.84],
      name: [1.5, 7.12, 18.5, 8.11],
      priceLabel: [1.5, 23.44, 18.5, 1.84],
      price: [1.5, 25.28, 18.5, 3.22],
      symbol: [21.5, 1.5, 27, 27],
    });
  });
});
