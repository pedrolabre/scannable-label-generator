// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { DISPLAY_NAME_MAX_LENGTH } from '../schemas/productSchema.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';

import { computeLabelGeometry } from './labelGeometry.js';
import { LABEL_LAYOUTS } from './labelLayoutCatalog.js';
import {
  DIGIT_ADVANCE_RATIO,
  ELLIPSIS,
  FONT_SIZE_STEPS,
  TEXT_ADVANCE_RATIO,
  charBudget,
  fitCodeText,
  fitNameLines,
  fitPriceText,
  textWidthMm,
} from './labelText.js';

const SMALLEST_LAYOUT = [...LABEL_LAYOUTS].sort(
  (a, b) => a.widthMm * a.heightMm - b.widthMm * b.heightMm,
)[0];

const SMALLEST_GEOMETRY = computeLabelGeometry(SMALLEST_LAYOUT);

// Nome de comprimento maximo do contrato do produto, sem espaco, para que a
// quebra por palavra nao mascare o corte.
const LONGEST_NAME = 'Refrigeradorfrostfreeinoxduasportascompainelexternoedispenser'.slice(
  0,
  DISPLAY_NAME_MAX_LENGTH,
);

describe('corte do nome da etiqueta', () => {
  it('nao mexe no nome que ja cabe', () => {
    const fitted = fitNameLines('Geladeira 375 litros', SMALLEST_GEOMETRY.name);

    expect(fitted.truncated).toBe(false);
    expect(fitted.lines.join(' ')).toBe('Geladeira 375 litros');
  });

  it('corta o nome de comprimento maximo no menor modelo do catalogo', () => {
    expect(LONGEST_NAME).toHaveLength(DISPLAY_NAME_MAX_LENGTH);

    const fitted = fitNameLines(LONGEST_NAME, SMALLEST_GEOMETRY.name);

    expect(fitted.truncated).toBe(true);
    expect(fitted.lines).toHaveLength(SMALLEST_GEOMETRY.name.lines);
    expect(fitted.lines.at(-1).endsWith(ELLIPSIS)).toBe(true);
    expect(fitted.lines.every((line) => line.length <= fitted.charBudget)).toBe(true);
    expect(fitted.lines[0].startsWith(LONGEST_NAME.slice(0, 10))).toBe(true);
  });

  it('o nome de comprimento maximo cabe inteiro nos modelos maiores de varias linhas', () => {
    const larger = LABEL_LAYOUTS.filter(
      (layout) => layout.id !== SMALLEST_LAYOUT.id && computeLabelGeometry(layout).name.lines > 1,
    );

    expect(larger.length).toBeGreaterThan(0);

    for (const layout of larger) {
      const fitted = fitNameLines(LONGEST_NAME, computeLabelGeometry(layout).name);

      expect(fitted.truncated).toBe(false);
    }
  });

  it('a etiqueta de 10 por folha corta o nome de comprimento maximo na unica linha', () => {
    const geometry = computeLabelGeometry(LABEL_LAYOUTS.find((l) => l.id === 'etiqueta-media-10'));
    const fitted = fitNameLines(LONGEST_NAME, geometry.name);

    expect(geometry.name.lines).toBe(1);
    expect(fitted.truncated).toBe(true);
    expect(fitted.lines).toHaveLength(1);
    expect(fitted.lines[0].endsWith(ELLIPSIS)).toBe(true);
    expect(fitNameLines('Guarda-roupa casal seis portas', geometry.name).truncated).toBe(false);
  });

  it('quebra a palavra que nao cabe numa linha, sem estourar a largura', () => {
    const geometry = computeLabelGeometry(LABEL_LAYOUTS.find((l) => l.id === 'tag-grande'));
    const fitted = fitNameLines('X'.repeat(DISPLAY_NAME_MAX_LENGTH), geometry.name);

    for (const line of fitted.lines) {
      expect(line.length).toBeLessThanOrEqual(fitted.charBudget);
    }
  });
});

describe('o texto nunca estoura a zona que recebeu', () => {
  // Esta e a prova pura de que a etiqueta nao precisa crescer: o texto que nao
  // cabe e reduzido ou cortado dentro da zona, e a zona nao muda de tamanho.
  it.each(LABEL_LAYOUTS.map((layout) => [layout.id, layout]))(
    'nome, preco e codigo cabem nas suas zonas em %s',
    (_id, layout) => {
      const geometry = computeLabelGeometry(layout);
      const name = fitNameLines(LONGEST_NAME, geometry.name);
      const price = fitPriceText(formatCentavosAsBRL(12345678), geometry.price);
      const code = fitCodeText('7899123456789012345', geometry.code);

      for (const line of name.lines) {
        expect(textWidthMm(line, geometry.name.fontSizeMm, TEXT_ADVANCE_RATIO)).toBeLessThanOrEqual(
          geometry.name.widthMm + 1e-9,
        );
      }

      expect(name.lines.length).toBeLessThanOrEqual(geometry.name.lines);
      expect(
        textWidthMm(price.text, price.fontSizeMm, DIGIT_ADVANCE_RATIO),
      ).toBeLessThanOrEqual(geometry.price.widthMm + 1e-9);
      expect(textWidthMm(code.text, code.fontSizeMm, DIGIT_ADVANCE_RATIO)).toBeLessThanOrEqual(
        geometry.code.widthMm + 1e-9,
      );
    },
  );
});

describe('preco de seis digitos', () => {
  it('cabe no menor modelo do catalogo, reduzido de corpo e nunca cortado', () => {
    const formatted = formatCentavosAsBRL(12345678);

    expect(formatted).toBe('R$ 123.456,78');

    const price = fitPriceText(formatted, SMALLEST_GEOMETRY.price);

    expect(price.fits).toBe(true);
    expect(price.text).toBe(formatted);
    expect(price.step).toBeLessThan(1);
    expect(FONT_SIZE_STEPS).toContain(price.step);
    expect(price.fontSizeMm).toBeCloseTo(SMALLEST_GEOMETRY.price.fontSizeMm * price.step, 10);
  });

  it('o preco do dia a dia sai em corpo cheio no menor modelo', () => {
    const price = fitPriceText(formatCentavosAsBRL(123456), SMALLEST_GEOMETRY.price);

    expect(price.text).toBe('R$ 1.234,56');
    expect(price.step).toBe(1);
  });

  it('o preco mais alto do catalogo real sai em corpo cheio em todo modelo', () => {
    for (const layout of LABEL_LAYOUTS) {
      const price = fitPriceText(formatCentavosAsBRL(556990), computeLabelGeometry(layout).price);

      expect(price.text).toBe('R$ 5.569,90');
      expect(price.step).toBe(1);
    }
  });
});

describe('codigo numerico', () => {
  it('sai inteiro enquanto couber, porque e o texto que o simbolo devolve', () => {
    const code = fitCodeText('0012345', SMALLEST_GEOMETRY.code);

    expect(code.truncated).toBe(false);
    expect(code.text).toBe('0012345');
  });

  it('so e cortado abaixo do ultimo degrau de corpo', () => {
    const code = fitCodeText('9'.repeat(120), SMALLEST_GEOMETRY.code);

    expect(code.truncated).toBe(true);
    expect(code.text.endsWith(ELLIPSIS)).toBe(true);
    expect(code.step).toBe(FONT_SIZE_STEPS[FONT_SIZE_STEPS.length - 1]);
  });
});

describe('orcamento de caracteres', () => {
  it('e a largura dividida pelo avanco medio do caractere', () => {
    expect(charBudget(20, 2, 0.5)).toBe(20);
    expect(charBudget(0, 2, 0.5)).toBe(0);
    expect(charBudget(20, 0, 0.5)).toBe(0);
  });
});
