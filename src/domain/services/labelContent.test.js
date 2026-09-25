// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { pngDataUrl } from '../../lib/logoFixtures.js';

import {
  PRICE_LABEL_TEXT,
  describeFiscalLine,
  describeLabelContent,
  describeLabelLogo,
  formatNcm,
} from './labelContent.js';
import { computeLabelGeometry, zoneBounds } from './labelGeometry.js';
import { LABEL_LAYOUTS, findLabelLayout } from './labelLayoutCatalog.js';
import { resolveLogo } from './logoImage.js';

const PRODUCT = {
  systemCode: '118789',
  displayName: 'Cantinho café rubi',
  priceInCentavos: 85990,
  ean: '7899075420416',
  ncm: '94035000',
};

const HEADER = { companyName: 'Loja Inventada', installmentText: '10x no cartão' };

function roles(items) {
  return items.map((item) => item.role);
}

describe('linha fiscal', () => {
  it('escreve EAN e NCM, com o NCM no formato da nota', () => {
    expect(formatNcm('94035000')).toBe('9403.50.00');
    expect(describeFiscalLine(PRODUCT)).toBe('EAN 7899075420416 · NCM 9403.50.00');
  });

  it('omite a parte que faltar', () => {
    expect(describeFiscalLine({ ...PRODUCT, ncm: undefined })).toBe('EAN 7899075420416');
    expect(describeFiscalLine({ ...PRODUCT, ean: undefined })).toBe('NCM 9403.50.00');
    expect(describeFiscalLine({ ...PRODUCT, ean: undefined, ncm: undefined })).toBe('');
  });
});

describe('conteudo da etiqueta larga', () => {
  const geometry = computeLabelGeometry(findLabelLayout('tag-grande'));

  it('leva cada parte da etiqueta para a sua zona, na ordem de leitura', () => {
    const items = describeLabelContent({ product: PRODUCT, geometry, ...HEADER });

    expect(roles(items)).toEqual([
      'code',
      'company',
      'name',
      'priceLabel',
      'price',
      'installment',
      'fiscal',
    ]);
    expect(items.find((item) => item.role === 'priceLabel').text).toBe(PRICE_LABEL_TEXT);
    expect(items.find((item) => item.role === 'price').text).toBe('R$ 859,90');
    expect(items.find((item) => item.role === 'company').align).toBe('right');
    expect(items.find((item) => item.role === 'code')).toMatchObject({ bold: true, face: 'display' });
  });

  it('deixa de fora a empresa e o parcelamento desligados', () => {
    const items = describeLabelContent({ product: PRODUCT, geometry });

    expect(roles(items)).not.toContain('company');
    expect(roles(items)).not.toContain('installment');
  });

  it('deixa de fora a linha fiscal do produto sem EAN e sem NCM', () => {
    const items = describeLabelContent({
      product: { ...PRODUCT, ean: undefined, ncm: undefined },
      geometry,
      ...HEADER,
    });

    expect(roles(items)).not.toContain('fiscal');
  });

  it('corta com reticencias a empresa que nao cabe, sem sair da zona', () => {
    const items = describeLabelContent({
      product: PRODUCT,
      geometry,
      companyName: 'M'.repeat(40),
    });
    const company = items.find((item) => item.role === 'company');

    expect(company.text.endsWith('…')).toBe(true);
    expect(company.text.length).toBeLessThan(40);
  });
});

describe('conteudo da etiqueta compacta', () => {
  it('mantem codigo, empresa, nome e preco, sem parcelamento nem linha fiscal', () => {
    const geometry = computeLabelGeometry(findLabelLayout('etiqueta-pequena'));
    const items = describeLabelContent({ product: PRODUCT, geometry, ...HEADER });

    expect(roles(items)).not.toContain('installment');
    expect(roles(items)).not.toContain('fiscal');
    expect(roles(items)).toContain('company');
    expect(items.find((item) => item.role === 'company').align).toBe('left');
  });
});

describe('texto dentro da etiqueta', () => {
  it.each(LABEL_LAYOUTS.map((layout) => [layout.id, layout]))(
    'toda linha fica dentro da area util em %s',
    (_id, layout) => {
      const geometry = computeLabelGeometry(layout);
      const usable = zoneBounds(geometry.usable);

      for (const item of describeLabelContent({ product: PRODUCT, geometry, ...HEADER })) {
        expect(item.xMm).toBeGreaterThanOrEqual(usable.left - 1e-9);
        expect(item.xMm + item.widthMm).toBeLessThanOrEqual(usable.right + 1e-9);
        expect(item.yMm).toBeGreaterThanOrEqual(usable.top - 1e-9);
        expect(item.yMm + item.lineHeightMm).toBeLessThanOrEqual(usable.bottom + 1e-9);
      }
    },
  );
});

describe('logotipo', () => {
  const WIDE = computeLabelGeometry(findLabelLayout('etiqueta-media-10'));
  const COMPACT = computeLabelGeometry(findLabelLayout('etiqueta-pequena'));
  const WORDMARK = resolveLogo(pngDataUrl(400, 50));
  const SQUARE = resolveLogo(pngDataUrl(90, 90));

  it('toma o lugar do nome da empresa onde o modelo tem zona para ele', () => {
    const items = describeLabelContent({ product: PRODUCT, geometry: WIDE, ...HEADER, logo: WORDMARK });

    expect(roles(items)).not.toContain('company');
    expect(roles(items)).toEqual(['code', 'name', 'priceLabel', 'price', 'installment', 'fiscal']);
  });

  it('deixa o nome da empresa na etiqueta pequena, que nao tem zona para a imagem', () => {
    const items = describeLabelContent({ product: PRODUCT, geometry: COMPACT, ...HEADER, logo: WORDMARK });

    expect(roles(items)).toContain('company');
    expect(describeLabelLogo({ geometry: COMPACT, logo: WORDMARK })).toBeNull();
  });

  it('nao descreve imagem sem logotipo', () => {
    expect(describeLabelLogo({ geometry: WIDE, logo: null })).toBeNull();
    expect(describeLabelLogo({ geometry: WIDE })).toBeNull();
  });

  it.each([
    ['larga e baixa', WORDMARK],
    ['quadrada', SQUARE],
  ])('poe a imagem %s inteira na zona, sem distorcer, a direita e centrada na altura', (_name, logo) => {
    const item = describeLabelLogo({ geometry: WIDE, logo });
    const zone = zoneBounds(WIDE.logo);

    expect(item).toMatchObject({ role: 'logo', dataUrl: logo.dataUrl, format: 'PNG' });
    expect(item.widthMm / item.heightMm).toBeCloseTo(logo.widthPx / logo.heightPx, 10);
    expect(item.xMm).toBeGreaterThanOrEqual(zone.left - 1e-9);
    expect(item.yMm).toBeGreaterThanOrEqual(zone.top - 1e-9);
    expect(item.xMm + item.widthMm).toBeCloseTo(zone.right, 10);
    expect(item.yMm + item.heightMm).toBeLessThanOrEqual(zone.bottom + 1e-9);
    expect(item.yMm - zone.top).toBeCloseTo(zone.bottom - (item.yMm + item.heightMm), 10);

    // Um dos lados encosta na zona: a imagem sai no maior tamanho que cabe.
    const fillsWidth = Math.abs(item.widthMm - WIDE.logo.widthMm) < 1e-9;
    const fillsHeight = Math.abs(item.heightMm - WIDE.logo.heightMm) < 1e-9;

    expect(fillsWidth || fillsHeight).toBe(true);
  });
});
