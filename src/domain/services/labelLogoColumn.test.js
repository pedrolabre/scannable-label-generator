// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { pngDataUrl } from '../../lib/logoFixtures.js';

import { describeLabelContent, describeLabelLogo } from './labelContent.js';
import {
  LOGO_COLUMN_LAYOUT_IDS,
  computeLabelGeometry,
  listLabelZones,
  zoneBounds,
  zonesOverlap,
} from './labelGeometry.js';
import { LABEL_LAYOUTS, findLabelLayout } from './labelLayoutCatalog.js';
import { resolveLogo } from './logoImage.js';

const TEN_LAYOUT = findLabelLayout('etiqueta-media-10');
const PLAIN = computeLabelGeometry(TEN_LAYOUT);
const WITH_LOGO = computeLabelGeometry(TEN_LAYOUT, undefined, { withLogo: true });

const LOGO = resolveLogo(pngDataUrl(140, 100));
const WORDMARK = resolveLogo(pngDataUrl(400, 50));
const CREDIT = { rateHundredths: 800, interest: 'simples', installments: 10, roundToNinetyCents: false };
const HEADER = { companyName: 'Loja Inventada', card: { installments: 10 }, credit: CREDIT };

const SHORT = {
  systemCode: '118534',
  displayName: 'Mesa de centro',
  priceInCentavos: 20990,
  ncm: '94036000',
};
const LONG = {
  ...SHORT,
  displayName: 'Buffet aparador Eccos 3 portas nature/preto Fabrimoveis com pes de madeira',
};

const itemsOf = (items, role) => items.filter((item) => item.role === role);
const itemOf = (items, role) => items.find((item) => item.role === role);

describe('geometria da etiqueta de 10 com logotipo', () => {
  it('so a etiqueta de 10 por folha leva o logotipo na coluna do simbolo', () => {
    expect([...LOGO_COLUMN_LAYOUT_IDS]).toEqual(['etiqueta-media-10']);

    for (const layout of LABEL_LAYOUTS) {
      const geometry = computeLabelGeometry(layout, undefined, { withLogo: true });

      expect(geometry.logoColumn, layout.id).toBe(layout.id === 'etiqueta-media-10');
    }
  });

  it('sem logotipo, a geometria e a de antes', () => {
    expect(PLAIN.logoColumn).toBe(false);
    expect(computeLabelGeometry(TEN_LAYOUT, undefined, { withLogo: false })).toEqual(PLAIN);
  });

  it('nos outros modelos, o logotipo nao muda a geometria', () => {
    for (const layout of LABEL_LAYOUTS.filter((item) => item.id !== 'etiqueta-media-10')) {
      expect(computeLabelGeometry(layout, undefined, { withLogo: true }), layout.id).toEqual(
        computeLabelGeometry(layout),
      );
    }
  });

  it('nao muda o simbolo: mesmo lado e mesmo lugar', () => {
    expect(WITH_LOGO.symbol).toEqual(PLAIN.symbol);
  });

  it('a zona do logotipo e a coluna do simbolo, do topo ate o afastamento acima dele', () => {
    const { logo, symbol, usable, gapMm } = WITH_LOGO;

    expect(logo.xMm).toBeCloseTo(symbol.xMm, 10);
    expect(logo.widthMm).toBeCloseTo(symbol.sizeMm, 10);
    expect(logo.yMm).toBeCloseTo(usable.yMm, 10);
    expect(logo.yMm + logo.heightMm).toBeCloseTo(symbol.yMm - gapMm, 10);
    expect(logo.widthMm).toBeCloseTo(27, 1);
    expect(logo.heightMm).toBeCloseTo(13.1, 1);
    expect(logo.heightMm).toBeGreaterThan(PLAIN.logo.heightMm * 2.5);
  });

  it('o nome tem tres linhas na coluna da esquerda, no mesmo corpo de antes', () => {
    const { name, column } = WITH_LOGO;

    expect(name.lines).toBe(3);
    expect(name.widthMm).toBeCloseTo(column.widthMm, 10);
    expect(name.fontSizeMm).toBeCloseTo(PLAIN.name.fontSizeMm, 10);
    expect(name.yMm).toBeCloseTo(PLAIN.name.yMm, 10);
    expect(name.heightMm).toBeCloseTo(3 * name.lineHeightMm, 10);
  });

  it('a area comercial desce uma linha do nome, e a linha fiscal continua rente a base', () => {
    const shift = WITH_LOGO.name.lineHeightMm;

    for (const role of ['priceLabel', 'price', 'card', 'creditInstallment', 'creditRate']) {
      expect(WITH_LOGO[role].yMm, role).toBeCloseTo(PLAIN[role].yMm + shift, 10);
    }

    expect(WITH_LOGO.fiscal).toEqual(PLAIN.fiscal);
    expect(zoneBounds(WITH_LOGO.creditRate).bottom).toBeLessThanOrEqual(WITH_LOGO.fiscal.yMm);
  });

  it('nenhuma zona encosta em outra, e o logotipo so cobre a zona do nome da empresa', () => {
    const zones = listLabelZones(WITH_LOGO);

    zones.forEach(([roleA, zoneA], indexA) => {
      zones.slice(indexA + 1).forEach(([roleB, zoneB]) => {
        if (roleA === 'company' || roleB === 'company') {
          return;
        }

        expect(zonesOverlap(zoneA, zoneB), `${roleA} x ${roleB}`).toBe(false);
      });
    });

    zones
      .filter(([role]) => role !== 'company')
      .forEach(([role, zone]) => expect(zonesOverlap(WITH_LOGO.logo, zone), role).toBe(false));
  });
});

describe('logotipo na coluna do simbolo', () => {
  it.each([
    ['quase quadrado', LOGO],
    ['largo e baixo', WORDMARK],
  ])('poe o logotipo %s inteiro na zona, encostado no topo e a direita', (_name, logo) => {
    const item = describeLabelLogo({ geometry: WITH_LOGO, logo });
    const zone = zoneBounds(WITH_LOGO.logo);

    expect(item.widthMm / item.heightMm).toBeCloseTo(logo.widthPx / logo.heightPx, 10);
    expect(item.yMm).toBeCloseTo(zone.top, 10);
    expect(item.xMm + item.widthMm).toBeCloseTo(zone.right, 10);
    expect(item.xMm).toBeGreaterThanOrEqual(zone.left - 1e-9);
    expect(item.yMm + item.heightMm).toBeLessThanOrEqual(zone.bottom + 1e-9);
  });

  it('a etiqueta com logotipo nao escreve o nome da empresa', () => {
    const items = describeLabelContent({ product: SHORT, geometry: WITH_LOGO, ...HEADER, logo: LOGO });

    expect(itemOf(items, 'company')).toBeUndefined();
  });
});

describe('area comercial acompanha o nome', () => {
  const contentOf = (product, geometry) =>
    describeLabelContent({ product, geometry, ...HEADER, logo: geometry.logoColumn ? LOGO : null });

  it('nome em tres linhas: a area comercial fica onde a geometria pos', () => {
    const items = contentOf(LONG, WITH_LOGO);

    expect(itemsOf(items, 'name')).toHaveLength(3);
    expect(itemOf(items, 'priceLabel').yMm).toBeCloseTo(WITH_LOGO.priceLabel.yMm, 10);
    expect(itemOf(items, 'price').yMm).toBeCloseTo(WITH_LOGO.price.yMm, 10);
  });

  it('nome em uma linha: a vista, preco e linhas de apoio sobem duas linhas do nome', () => {
    const items = contentOf(SHORT, WITH_LOGO);
    const shift = 2 * WITH_LOGO.name.lineHeightMm;
    const long = contentOf(LONG, WITH_LOGO);

    expect(itemsOf(items, 'name')).toHaveLength(1);

    for (const role of ['priceLabel', 'price', 'card', 'creditInstallment', 'creditRate']) {
      expect(itemOf(items, role).yMm, role).toBeCloseTo(itemOf(long, role).yMm - shift, 10);
    }

    expect(itemOf(items, 'fiscal').yMm).toBeCloseTo(itemOf(long, 'fiscal').yMm, 10);
  });

  it('a area comercial nunca sobe por cima do nome', () => {
    [SHORT, LONG, { ...SHORT, displayName: 'Rack' }].forEach((product) => {
      const items = contentOf(product, WITH_LOGO);
      const lastName = itemsOf(items, 'name').at(-1);

      expect(itemOf(items, 'priceLabel').yMm).toBeGreaterThanOrEqual(
        lastName.yMm + lastName.lineHeightMm - 1e-9,
      );
    });
  });

  it('sem logotipo, nome curto nao move a area comercial', () => {
    const items = contentOf(SHORT, PLAIN);

    expect(itemOf(items, 'priceLabel').yMm).toBeCloseTo(PLAIN.priceLabel.yMm, 10);
    expect(itemOf(items, 'price').yMm).toBeCloseTo(PLAIN.price.yMm, 10);
  });

  it('as linhas de apoio continuam sem passar da linha fiscal', () => {
    [SHORT, LONG].forEach((product) => {
      const items = contentOf(product, WITH_LOGO);
      const fiscal = itemOf(items, 'fiscal');

      items
        .filter((item) => ['card', 'creditInstallment', 'creditRate'].includes(item.role))
        .forEach((item) => expect(item.yMm + item.lineHeightMm).toBeLessThanOrEqual(fiscal.yMm + 1e-9));
    });
  });
});
