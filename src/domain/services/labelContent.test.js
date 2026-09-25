// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { pngDataUrl } from '../../lib/logoFixtures.js';

import {
  LABEL_BAND_COLOR,
  PRICE_LABEL_TEXT,
  describeFiscalLine,
  describeLabelBand,
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

const HEADER = { companyName: 'Loja Inventada', card: { installments: 10 } };

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
      'card',
      'fiscal',
    ]);
    expect(items.find((item) => item.role === 'card').text).toBe('10x sem juros no cartão');
    expect(items.find((item) => item.role === 'priceLabel').text).toBe(PRICE_LABEL_TEXT);
    expect(items.find((item) => item.role === 'price').text).toBe('R$ 859,90');
    expect(items.find((item) => item.role === 'company').align).toBe('right');
    expect(items.find((item) => item.role === 'code')).toMatchObject({ bold: true, face: 'display' });
  });

  it('deixa de fora a empresa e o cartao desligados', () => {
    const items = describeLabelContent({ product: PRODUCT, geometry });

    expect(roles(items)).not.toContain('company');
    expect(roles(items)).not.toContain('card');
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
  it('mantem codigo, empresa, nome e preco, sem cartao nem linha fiscal', () => {
    const geometry = computeLabelGeometry(findLabelLayout('etiqueta-pequena'));
    const items = describeLabelContent({ product: PRODUCT, geometry, ...HEADER });

    expect(roles(items)).not.toContain('card');
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
    expect(roles(items)).toEqual(['code', 'name', 'priceLabel', 'price', 'card', 'fiscal']);
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

describe('cartao e crediario', () => {
  const TEN = computeLabelGeometry(findLabelLayout('etiqueta-media-10'));
  const TAG = computeLabelGeometry(findLabelLayout('tag-grande'));
  const MEDIUM = computeLabelGeometry(findLabelLayout('etiqueta-media'));
  const CREDIT = { rateHundredths: 800, interest: 'simples', installments: 10, roundToNinetyCents: false };
  const text = (items, role) => items.find((item) => item.role === role)?.text;

  it('escreve cartao, parcela do crediario e taxa abaixo do preco, nessa ordem', () => {
    const items = describeLabelContent({ product: PRODUCT, geometry: TEN, ...HEADER, credit: CREDIT });

    expect(roles(items)).toEqual([
      'code',
      'company',
      'name',
      'priceLabel',
      'price',
      'card',
      'creditInstallment',
      'creditRate',
      'fiscal',
    ]);
    expect(text(items, 'card')).toBe('10x sem juros no cartão');
    // 859,90 x (1 + 0,08 x 10) / 10 = 154,782, que fica 154,78.
    expect(text(items, 'creditInstallment')).toBe('Crediário: 10x de R$ 154,78');
    expect(text(items, 'creditRate')).toBe('Taxa de Juros: 8% a.m.');
    expect(items.find((item) => item.role === 'creditInstallment')).toMatchObject({ bold: true, digits: true });
  });

  it('faz a conta composta e o arredondamento para ,90', () => {
    const compound = describeLabelContent({
      product: PRODUCT,
      geometry: TAG,
      credit: { ...CREDIT, interest: 'composto', roundToNinetyCents: true },
    });

    // 859,90 x 0,08 / (1 - 1,08^-10) = 128,15; no mesmo real com ,90: 128,90.
    expect(text(compound, 'creditInstallment')).toBe('Crediário: 10x de R$ 128,90');
  });

  it('com Nenhum, leva so a taxa, sem valor a prazo', () => {
    const items = describeLabelContent({
      product: PRODUCT,
      geometry: TEN,
      ...HEADER,
      credit: { ...CREDIT, interest: 'nenhum', installments: null },
    });

    expect(roles(items)).not.toContain('creditInstallment');
    expect(text(items, 'creditRate')).toBe('Taxa de Juros: 8% a.m.');
  });

  it('sobe a linha de baixo para o lugar da que nao saiu', () => {
    const priceBottom = TEN.price.yMm + TEN.price.heightMm;
    const withoutCard = describeLabelContent({ product: PRODUCT, geometry: TEN, credit: CREDIT });
    const installment = withoutCard.find((item) => item.role === 'creditInstallment');
    const rate = withoutCard.find((item) => item.role === 'creditRate');

    expect(installment.yMm).toBeCloseTo(priceBottom, 10);
    expect(rate.yMm).toBeCloseTo(priceBottom + installment.lineHeightMm, 10);

    const onlyRate = describeLabelContent({
      product: PRODUCT,
      geometry: TEN,
      credit: { ...CREDIT, interest: 'nenhum' },
    });

    expect(onlyRate.find((item) => item.role === 'creditRate').yMm).toBeCloseTo(priceBottom, 10);
  });

  it('sem crediario, a etiqueta sai so com o cartao', () => {
    const items = describeLabelContent({ product: PRODUCT, geometry: TAG, ...HEADER });

    expect(roles(items)).toEqual(['code', 'company', 'name', 'priceLabel', 'price', 'card', 'fiscal']);
  });

  it('nao leva crediario aos modelos sem crediario, e mantem o cartao neles', () => {
    const items = describeLabelContent({ product: PRODUCT, geometry: MEDIUM, ...HEADER, credit: CREDIT });

    expect(roles(items)).not.toContain('creditInstallment');
    expect(roles(items)).not.toContain('creditRate');
    expect(text(items, 'card')).toBe('10x sem juros no cartão');
  });

  it('mantem a taxa no produto cujo preco nao da um centavo por parcela', () => {
    const items = describeLabelContent({
      product: { ...PRODUCT, priceInCentavos: 1 },
      geometry: TEN,
      credit: CREDIT,
    });

    expect(roles(items)).not.toContain('creditInstallment');
    expect(roles(items)).toContain('creditRate');
  });

  it.each([
    ['etiqueta-media-10', TEN],
    ['tag-grande', TAG],
  ])('toda linha, com tudo ligado, fica dentro da area util em %s', (_id, geometry) => {
    const usable = zoneBounds(geometry.usable);
    const items = describeLabelContent({
      product: { ...PRODUCT, priceInCentavos: 999999 },
      geometry,
      companyName: 'Loja Inventada',
      card: { installments: 24 },
      credit: { rateHundredths: 1999, interest: 'composto', installments: 24, roundToNinetyCents: false },
    });

    for (const item of items) {
      expect(item.xMm + item.widthMm).toBeLessThanOrEqual(usable.right + 1e-9);
      expect(item.yMm + item.lineHeightMm).toBeLessThanOrEqual(usable.bottom + 1e-9);
    }

    const fiscal = items.find((item) => item.role === 'fiscal');
    const rate = items.find((item) => item.role === 'creditRate');

    expect(rate.yMm + rate.lineHeightMm).toBeLessThanOrEqual(fiscal.yMm + 1e-9);
  });
});

describe('faixa da base', () => {
  it('sai na cor da marca nos modelos com crediario, e em nenhum outro', () => {
    for (const layout of LABEL_LAYOUTS) {
      const geometry = computeLabelGeometry(layout);
      const band = describeLabelBand({ geometry });

      if (geometry.band) {
        expect(band).toMatchObject({ role: 'band', xMm: geometry.band.xMm, yMm: geometry.band.yMm, color: LABEL_BAND_COLOR });
      } else {
        expect(band).toBeNull();
      }
    }

    expect(LABEL_BAND_COLOR).toEqual({ hex: '#C1121F', red: 193, green: 18, blue: 31 });
  });
});
