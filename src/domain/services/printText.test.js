// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { trimToWidth } from './printText.js';

/**
 * A medicao entra falsa e previsivel — um milimetro por caractere — para que o
 * que se prova seja a regra do corte, e nao a metrica de uma fonte.
 */
const measure = (text) => text.length;

describe('corte pela largura real', () => {
  it('devolve o texto inteiro quando ele cabe', () => {
    expect(trimToWidth('Armário', 10, measure)).toBe('Armário');
  });

  it('corta e fecha com reticencias quando nao cabe', () => {
    expect(trimToWidth('Armário de cozinha', 10, measure)).toBe('Armário d…');
  });

  it('nao deixa espaco antes das reticencias', () => {
    expect(trimToWidth('Armário de cozinha', 9, measure)).toBe('Armário…');
  });

  it('devolve so as reticencias quando cabe apenas um caractere', () => {
    expect(trimToWidth('Armário', 1, measure)).toBe('…');
  });

  it('devolve texto vazio quando nem as reticencias cabem', () => {
    expect(trimToWidth('Armário', 0.5, measure)).toBe('');
  });

  it('devolve texto vazio para entrada vazia', () => {
    expect(trimToWidth('', 10, measure)).toBe('');
    expect(trimToWidth(undefined, 10, measure)).toBe('');
  });
});
