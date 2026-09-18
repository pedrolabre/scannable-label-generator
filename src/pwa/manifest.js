import { APP_NAME } from '../lib/app-meta.js';

/**
 * Metadados de instalacao da aplicacao, em funcao pura.
 *
 * O arquivo publicado nao e escrito a mao: o empacotador o gera a partir deste
 * objeto e injeta o vinculo no documento. Uma copia escrita a mao em `public/`
 * seria uma segunda fonte de verdade, livre para divergir em silencio.
 *
 * A descricao repete a que esta no `<head>` do documento porque o HTML e
 * estatico e nao importa modulo; as duas mudam juntas.
 */

export const APP_DESCRIPTION =
  'Gerador de etiquetas com código 2D que funciona inteiramente no navegador.';

/** Cor de marca, a mesma da acao principal da interface. */
export const THEME_COLOR = '#cf1026';

/** Fundo claro da aplicacao, usado na tela de abertura. */
export const BACKGROUND_COLOR = '#f8fafc';

export const ICON_BASE_PATH = '/icons';

export const appIcons = [
  {
    src: `${ICON_BASE_PATH}/icon-192.png`,
    sizes: '192x192',
    type: 'image/png',
    purpose: 'any',
  },
  {
    src: `${ICON_BASE_PATH}/icon-512.png`,
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any',
  },
  {
    src: `${ICON_BASE_PATH}/icon-maskable-512.png`,
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  },
];

export const appManifest = {
  name: APP_NAME,
  short_name: APP_NAME,
  description: APP_DESCRIPTION,
  lang: 'pt-BR',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  theme_color: THEME_COLOR,
  background_color: BACKGROUND_COLOR,
  icons: appIcons,
};
