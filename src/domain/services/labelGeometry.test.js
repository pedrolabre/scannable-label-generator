// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { MIN_MODULE_SIZE_MM } from '../../lib/barcodeSizing.js';

import {
  LINE_HEIGHT_RATIO,
  LabelGeometryError,
  NOMINAL_TOTAL_MODULES,
  computeLabelGeometry,
  zoneBounds,
  zonesOverlap,
} from './labelGeometry.js';
import { LABEL_LAYOUTS } from './labelLayoutCatalog.js';

const BASE_LAYOUT = {
  id: 'modelo-de-prova',
  name: 'Modelo de prova',
  widthMm: 60,
  heightMm: 40,
  paddingMm: 3,
  symbolSizeMm: 22,
};

describe('zonas fixas da etiqueta', () => {
  it('ancora o simbolo no canto inferior direito da area util', () => {
    const geometry = computeLabelGeometry(BASE_LAYOUT);
    const usable = zoneBounds(geometry.usable);
    const symbol = zoneBounds(geometry.symbol);

    expect(symbol.right).toBeCloseTo(usable.right, 10);
    expect(symbol.bottom).toBeCloseTo(usable.bottom, 10);
  });

  it('poe o nome no topo, o preco no alto da coluna e o codigo rente a base', () => {
    const geometry = computeLabelGeometry(BASE_LAYOUT);

    expect(geometry.name.yMm).toBeCloseTo(geometry.usable.yMm, 10);
    expect(geometry.price.yMm).toBeCloseTo(geometry.column.yMm, 10);
    expect(zoneBounds(geometry.code).bottom).toBeCloseTo(zoneBounds(geometry.usable).bottom, 10);
    expect(geometry.code.xMm).toBeCloseTo(geometry.usable.xMm, 10);
  });

  it('mantem toda zona dentro da area util', () => {
    const usable = zoneBounds(computeLabelGeometry(BASE_LAYOUT).usable);
    const geometry = computeLabelGeometry(BASE_LAYOUT);

    for (const zone of [geometry.name, geometry.price, geometry.code, geometry.symbol]) {
      const bounds = zoneBounds(zone);

      expect(bounds.left).toBeGreaterThanOrEqual(usable.left - 1e-9);
      expect(bounds.top).toBeGreaterThanOrEqual(usable.top - 1e-9);
      expect(bounds.right).toBeLessThanOrEqual(usable.right + 1e-9);
      expect(bounds.bottom).toBeLessThanOrEqual(usable.bottom + 1e-9);
    }
  });
});

describe('a zona do simbolo nao e invadida', () => {
  // Prova calculada, e nao renderizada: as zonas saem das medidas do modelo,
  // entao a nao invasao pode ser conferida sem montar componente nenhum.
  it.each(LABEL_LAYOUTS.map((layout) => [layout.id, layout]))(
    'nenhuma zona de texto encosta no simbolo em %s',
    (_id, layout) => {
      const geometry = computeLabelGeometry(layout);

      expect(zonesOverlap(geometry.name, geometry.symbol)).toBe(false);
      expect(zonesOverlap(geometry.price, geometry.symbol)).toBe(false);
      expect(zonesOverlap(geometry.code, geometry.symbol)).toBe(false);
    },
  );

  it.each(LABEL_LAYOUTS.map((layout) => [layout.id, layout]))(
    'guarda o afastamento minimo entre o simbolo e o texto em %s',
    (_id, layout) => {
      const geometry = computeLabelGeometry(layout);
      const symbol = zoneBounds(geometry.symbol);

      expect(symbol.left - zoneBounds(geometry.column).right).toBeCloseTo(geometry.gapMm, 10);
      expect(symbol.top - zoneBounds(geometry.name).bottom).toBeGreaterThanOrEqual(
        geometry.gapMm - 1e-9,
      );
      expect(geometry.gapMm).toBeGreaterThanOrEqual(1.5);
    },
  );
});

describe('recusa de modelo inviavel', () => {
  it('recusa o simbolo abaixo do piso de modulo em vez de arredondar', () => {
    const belowFloor = NOMINAL_TOTAL_MODULES * MIN_MODULE_SIZE_MM - 0.5;

    expect(() =>
      computeLabelGeometry({ ...BASE_LAYOUT, symbolSizeMm: belowFloor }),
    ).toThrow(LabelGeometryError);
  });

  it('recusa a margem interna que consome a area util', () => {
    expect(() => computeLabelGeometry({ ...BASE_LAYOUT, paddingMm: 20 })).toThrow(
      LabelGeometryError,
    );
  });

  it('recusa o simbolo que nao deixa coluna para o preco e o codigo', () => {
    expect(() =>
      computeLabelGeometry({ ...BASE_LAYOUT, widthMm: 40, heightMm: 60, symbolSizeMm: 34 }),
    ).toThrow(LabelGeometryError);
  });

  it('recusa a altura que nao comporta uma linha de nome acima do simbolo', () => {
    expect(() =>
      computeLabelGeometry({ ...BASE_LAYOUT, widthMm: 80, heightMm: 30, symbolSizeMm: 23 }),
    ).toThrow(LabelGeometryError);
  });
});

describe('proporcoes derivadas das medidas', () => {
  it('nao depende do conteudo do produto, so do modelo', () => {
    expect(computeLabelGeometry(BASE_LAYOUT)).toEqual(computeLabelGeometry({ ...BASE_LAYOUT }));
  });

  it('mantem a hierarquia do preco acima do nome e do codigo', () => {
    for (const layout of LABEL_LAYOUTS) {
      const geometry = computeLabelGeometry(layout);

      expect(geometry.price.fontSizeMm).toBeGreaterThan(geometry.name.fontSizeMm);
      expect(geometry.name.fontSizeMm).toBeGreaterThanOrEqual(geometry.code.fontSizeMm);
    }
  });

  it('usa a mesma altura de linha em toda a etiqueta', () => {
    const geometry = computeLabelGeometry(BASE_LAYOUT);

    expect(geometry.name.lineHeightMm).toBeCloseTo(
      geometry.name.fontSizeMm * LINE_HEIGHT_RATIO,
      10,
    );
    expect(geometry.price.heightMm).toBeCloseTo(geometry.price.fontSizeMm * LINE_HEIGHT_RATIO, 10);
  });
});
