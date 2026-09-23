// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Conferencia da marca no codigo-fonte. A cor mora nos tokens de
 * `tailwind.config.js` e o canto e reto em todo o produto; as duas regras so
 * valem se nenhum arquivo de `src` escapar delas por uma classe escrita a mao.
 *
 * O que se procura e o que passa por fora do tema: o raio ou a cor escritos
 * entre colchetes, a escala de raio que o Tailwind traz de fabrica e que a
 * chave unica do tema nao apaga, a paleta padrao e a variante escura, que os
 * tokens nao tem.
 *
 * Nenhuma classe proibida aparece inteira neste arquivo, nem em comentario: o
 * Tailwind le todo o `src` atras de classe, e o nome escrito aqui voltaria
 * como regra no CSS gerado.
 *
 * Os arquivos de teste ficam de fora: eles descrevem desenho de simbolo e cor
 * de pixel, e nao montam classe de interface.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

const PALETTE = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
].join('|');

const COLOR_UTILITIES = [
  'text',
  'bg',
  'border',
  'divide',
  'outline',
  'ring',
  'fill',
  'stroke',
  'accent',
  'placeholder',
  'decoration',
  'caret',
  'from',
  'via',
  'to',
  'shadow',
].join('|');

const RADIUS_SCALE = 'sm|md|lg|xl|2xl|3xl|full';
const RADIUS_SIDES = 't|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee';

const RULES = [
  ['raio entre colchetes', new RegExp(`rounded(?:-(?:${RADIUS_SIDES}))?-\\[`)],
  ['raio da escala padrao', new RegExp(`rounded(?:-(?:${RADIUS_SIDES}))?-(?:${RADIUS_SCALE})\\b`)],
  ['cor literal entre colchetes', new RegExp(`(?:${COLOR_UTILITIES})-\\[(?:#|rgb|hsl)`)],
  ['paleta padrao do Tailwind', new RegExp(`\\b(?:${COLOR_UTILITIES})-(?:${PALETTE})-\\d{2,3}\\b`)],
  ['branco ou preto fora do token', new RegExp(`\\b(?:${COLOR_UTILITIES})-(?:white|black)\\b`)],
  ['variante escura', /(?:^|[\s'"`])dark:/],
];

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return /\.(js|jsx)$/.test(entry.name) && !/\.test\.(js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

function violations(regex) {
  return sourceFiles(SRC).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => regex.test(line))
      .map(({ line, index }) => `${relative(SRC, file)}:${index + 1}: ${line.trim()}`),
  );
}

describe('classes de marca no codigo-fonte', () => {
  it('encontra os arquivos que confere', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(50);
  });

  it.each(RULES)('nao tem %s', (_, regex) => {
    expect(violations(regex)).toEqual([]);
  });

  it('pega o que deve pegar', () => {
    // Os exemplos sao montados por partes, pelo motivo dito no alto do arquivo.
    const exemplos = [
      ['rounded', '[3px]'],
      ['rounded', 'full'],
      ['rounded', 't', 'lg'],
      ['text', '[#8a5a00]'],
      ['border', 'slate', '200'],
      ['bg', 'white'],
      [' dark:text', 'slate', '300'],
    ].map((partes) => partes.join('-'));

    for (const exemplo of exemplos) {
      expect(
        RULES.some(([, regex]) => regex.test(exemplo)),
        exemplo,
      ).toBe(true);
    }

    for (const permitido of [
      'rounded',
      'text-neutro-tinta',
      'bg-etiqueta-papel',
      '-translate-y-1/2',
    ]) {
      expect(
        RULES.some(([, regex]) => regex.test(permitido)),
        permitido,
      ).toBe(false);
    }
  });
});
