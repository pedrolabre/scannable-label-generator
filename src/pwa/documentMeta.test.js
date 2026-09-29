// @vitest-environment node

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { APP_NAME } from '../lib/app-meta.js';

import { APP_DESCRIPTION } from './manifest.js';

/**
 * O `index.html` e estatico e nao importa modulo, entao o titulo e a descricao
 * dele sao escritos a mao. Este arquivo le o documento como texto e confere que
 * os dois continuam iguais ao nome e a descricao que a aplicacao usa no
 * cabecalho, no manifesto e no PDF.
 */

const documento = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

function unico(padrao) {
  const encontrados = [...documento.matchAll(padrao)];

  expect(encontrados).toHaveLength(1);

  return encontrados[0][1];
}

describe('identidade no index.html', () => {
  it('usa o nome do produto no titulo', () => {
    expect(unico(/<title>([^<]*)<\/title>/g)).toBe(APP_NAME);
  });

  it('descreve a aplicacao com o mesmo texto do manifesto', () => {
    expect(unico(/<meta\s+name="description"\s+content="([^"]*)"/g)).toBe(APP_DESCRIPTION);
  });
});
