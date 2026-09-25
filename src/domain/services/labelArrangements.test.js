// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  CREDIT_LAYOUT_IDS,
  LINE_HEIGHT_RATIO,
  computeLabelGeometry,
  listLabelZones,
  zoneBounds,
  zonesOverlap,
} from './labelGeometry.js';
import { LABEL_LAYOUTS, findLabelLayout } from './labelLayoutCatalog.js';

const geometryOf = (id) => computeLabelGeometry(findLabelLayout(id));

function box(zone) {
  return [zone.xMm, zone.yMm, zone.widthMm ?? zone.sizeMm, zone.heightMm ?? zone.sizeMm];
}

function expectBox(zone, expected) {
  box(zone).forEach((value, index) => expect(value).toBeCloseTo(expected[index], 2));
}

describe('simbolo', () => {
  // Posicao e lado de cada modelo antes do crediario, conferidos a mao.
  const SYMBOLS = {
    'etiqueta-media-10': [55.2, 17.1, 27, 27],
    'tag-grande': [64, 34, 32, 32],
    'etiqueta-media': [40, 20, 27, 27],
    'etiqueta-pequena': [21.5, 1.5, 27, 27],
  };

  it.each(Object.entries(SYMBOLS))('mantem posicao e lado em %s', (id, expected) => {
    expectBox(geometryOf(id).symbol, expected);
  });
});

describe('modelos sem crediario', () => {
  // Zonas da etiqueta media e da pequena antes do crediario, em mm.
  const BEFORE = {
    'etiqueta-media': {
      code: [3, 3, 28.8, 4.05],
      company: [32.76, 3, 34.24, 4.05],
      name: [3, 8.01, 64, 7.36],
      priceLabel: [3, 16.33, 35.5, 2.02],
      price: [3, 18.35, 35.5, 6.19],
      card: [3, 24.54, 35.5, 2.21],
      fiscal: [3, 45.16, 35.5, 1.84],
      symbol: [40, 20, 27, 27],
    },
    'etiqueta-pequena': {
      code: [1.5, 1.5, 18.5, 2.97],
      company: [1.5, 4.47, 18.5, 1.84],
      name: [1.5, 7.12, 18.5, 8.11],
      priceLabel: [1.5, 23.44, 18.5, 1.84],
      price: [1.5, 25.28, 18.5, 3.22],
      symbol: [21.5, 1.5, 27, 27],
    },
  };

  it.each(Object.keys(BEFORE))('%s mantem as zonas de antes, sem crediario nem faixa', (id) => {
    const geometry = geometryOf(id);
    const zones = Object.fromEntries(listLabelZones(geometry));

    expect(Object.keys(zones)).toEqual(Object.keys(BEFORE[id]));
    Object.entries(BEFORE[id]).forEach(([role, expected]) => expectBox(zones[role], expected));
    expect(geometry.creditInstallment).toBeNull();
    expect(geometry.creditRate).toBeNull();
    expect(geometry.band).toBeNull();
  });
});

describe('modelos com crediario', () => {
  it('sao a etiqueta de 10 por folha e a tag grande', () => {
    expect([...CREDIT_LAYOUT_IDS].sort()).toEqual(['etiqueta-media-10', 'tag-grande']);

    for (const layout of LABEL_LAYOUTS) {
      const geometry = computeLabelGeometry(layout);
      const expected = CREDIT_LAYOUT_IDS.includes(layout.id);

      expect(geometry.creditInstallment !== null, layout.id).toBe(expected);
      expect(geometry.band !== null, layout.id).toBe(expected);
    }
  });

  it.each(CREDIT_LAYOUT_IDS)('%s empilha preco, cartao, parcela do crediario e taxa', (id) => {
    const geometry = geometryOf(id);
    const bottom = (zone) => zoneBounds(zone).bottom;

    expect(geometry.card.yMm).toBeCloseTo(bottom(geometry.price), 10);
    expect(geometry.creditInstallment.yMm).toBeCloseTo(bottom(geometry.card), 10);
    expect(geometry.creditRate.yMm).toBeCloseTo(bottom(geometry.creditInstallment), 10);
    expect(bottom(geometry.creditRate)).toBeLessThanOrEqual(geometry.fiscal.yMm);
  });

  it.each(CREDIT_LAYOUT_IDS)('%s: a parcela fica abaixo do preco e nenhuma linha abaixo da fiscal', (id) => {
    const geometry = geometryOf(id);

    expect(geometry.creditInstallment.fontSizeMm).toBeLessThan(geometry.price.fontSizeMm);
    expect(geometry.creditInstallment.fontSizeMm).toBeGreaterThan(geometry.fiscal.fontSizeMm);
    expect(geometry.creditRate.fontSizeMm).toBeGreaterThan(geometry.fiscal.fontSizeMm);
    expect(geometry.card.fontSizeMm).toBeGreaterThan(geometry.fiscal.fontSizeMm);
  });
});

describe('nome da etiqueta de 10 por folha', () => {
  const geometry = geometryOf('etiqueta-media-10');

  it('sai em duas linhas, acima do simbolo e com o afastamento guardado', () => {
    expect(geometry.name.lines).toBe(2);
    expect(geometry.name.heightMm).toBeCloseTo(2 * geometry.name.fontSizeMm * LINE_HEIGHT_RATIO, 10);
    expect(geometry.symbol.yMm - zoneBounds(geometry.name).bottom).toBeGreaterThanOrEqual(geometry.gapMm - 1e-9);
    expect(geometry.name.fontSizeMm).toBeCloseTo(2.98, 2);
  });

  it('reduz so o nome: os outros corpos continuam os do modelo', () => {
    expect(geometry.price.fontSizeMm).toBeCloseTo(7.76, 2);
    expect(geometry.priceLabel.fontSizeMm).toBeCloseTo(2.19, 2);
    expect(geometry.fiscal.fontSizeMm).toBeCloseTo(1.99, 2);
    expect(geometry.code.fontSizeMm).toBeCloseTo(4.38, 2);
  });

  it('a tag grande continua com tres linhas no corpo do modelo', () => {
    const tag = geometryOf('tag-grande');

    expect(tag.name.lines).toBe(3);
    expect(tag.name.fontSizeMm).toBeCloseTo(4.6, 2);
  });
});

describe('faixa da base', () => {
  it.each(CREDIT_LAYOUT_IDS)('%s: na margem de baixo, sem tocar simbolo, texto nem a borda de corte', (id) => {
    const geometry = geometryOf(id);
    const band = zoneBounds(geometry.band);
    const usable = zoneBounds(geometry.usable);

    expect(band.left).toBeCloseTo(usable.left, 10);
    expect(band.right).toBeCloseTo(usable.right, 10);
    expect(band.top).toBeGreaterThan(zoneBounds(geometry.symbol).bottom);
    expect(band.top).toBeGreaterThan(usable.bottom);
    expect(band.bottom).toBeLessThan(geometry.heightMm);
    expect(band.bottom - band.top).toBeGreaterThan(0.5);

    for (const [role, zone] of listLabelZones(geometry)) {
      expect(zonesOverlap(geometry.band, zone), role).toBe(false);
    }
  });
});
