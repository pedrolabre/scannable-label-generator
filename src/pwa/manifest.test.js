// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { APP_NAME } from '../lib/app-meta.js';

import {
  APP_DESCRIPTION,
  BACKGROUND_COLOR,
  THEME_COLOR,
  appIcons,
  appManifest,
} from './manifest.js';

/**
 * O arquivo publicado e gerado no empacotamento, entao o que se prova aqui e a
 * fonte dele: os campos que a instalacao usa e os icones que ela oferece. Que o
 * navegador aceita o arquivo gerado e conferencia manual, na aba de aplicativo.
 */

describe('identidade da aplicacao instalada', () => {
  it('usa o nome publico do produto no nome longo e no curto', () => {
    expect(appManifest.name).toBe(APP_NAME);
    expect(appManifest.short_name).toBe(APP_NAME);
  });

  it('mantem o nome curto dentro do limite util das telas de instalacao', () => {
    expect(appManifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it('descreve a aplicacao com o mesmo texto do documento', () => {
    expect(appManifest.description).toBe(APP_DESCRIPTION);
    expect(appManifest.description).toMatch(/navegador/);
  });

  it('declara o idioma da interface', () => {
    expect(appManifest.lang).toBe('pt-BR');
  });
});

describe('janela da aplicacao', () => {
  it('abre na raiz e limita o alcance a ela', () => {
    expect(appManifest.start_url).toBe('/');
    expect(appManifest.scope).toBe('/');
  });

  it('abre em janela propria, sem barra de navegacao', () => {
    expect(appManifest.display).toBe('standalone');
  });

  it('leva a cor de marca e o fundo claro da aplicacao', () => {
    expect(appManifest.theme_color).toBe(THEME_COLOR);
    expect(appManifest.background_color).toBe(BACKGROUND_COLOR);
    expect(THEME_COLOR).toBe('#C1121F');
    expect(BACKGROUND_COLOR).toBe('#FAFAFA');
  });
});

describe('icones oferecidos a instalacao', () => {
  it('oferece os dois tamanhos que as telas de instalacao pedem', () => {
    const tamanhos = appIcons.filter((icone) => icone.purpose === 'any').map((icone) => icone.sizes);

    expect(tamanhos).toEqual(['192x192', '512x512']);
  });

  it('oferece um icone recortavel, para o desenho circular do sistema', () => {
    const recortaveis = appIcons.filter((icone) => icone.purpose === 'maskable');

    expect(recortaveis).toHaveLength(1);
    expect(recortaveis[0].sizes).toBe('512x512');
  });

  it('aponta todos os icones para arquivos PNG na pasta publicada', () => {
    for (const icone of appIcons) {
      expect(icone.type).toBe('image/png');
      expect(icone.src.startsWith('/icons/')).toBe(true);
      expect(icone.src.endsWith('.png')).toBe(true);
    }
  });

  it('leva a mesma lista de icones para o arquivo publicado', () => {
    expect(appManifest.icons).toBe(appIcons);
  });
});
