import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import { appManifest } from './src/pwa/manifest.js';

/**
 * Dois ajustes de empacotamento, ambos sobre o que sai em `dist/assets`.
 *
 * O primeiro deixa de fora tres modulos que a biblioteca de PDF so carrega nos
 * caminhos de captura de tela e de conversao de SVG, que esta aplicacao nao
 * usa: sem isso o empacotador gera tres arquivos que nunca sao pedidos.
 *
 * O segundo separa a biblioteca de interface num arquivo proprio. Ela muda de
 * versao muito mais devagar do que o codigo da aplicacao, entao separada ela
 * fica no cache do navegador entre uma publicacao e outra, e o arquivo da
 * aplicacao volta a caber com folga no limite de aviso do empacotador.
 */
const UNUSED_PDF_MODULES = ['html2canvas', 'dompurify', 'canvg'];

/**
 * A aplicacao instalada guarda tudo o que a build produziu, e nao so a primeira
 * tela: os dois motores carregados sob demanda tambem entram. Quem instalou o
 * aplicativo, nunca exportou um PDF e depois ficou sem rede continuaria com o
 * cadastro e a previa funcionando, mas veria a exportacao falhar no `import()`
 * — e a promessa e que nenhuma funcao essencial dependa de rede.
 *
 * Nenhum recurso externo e guardado porque nao existe nenhum: depois de
 * carregada, a aplicacao nao faz chamada de rede. As duas faces de texto sao
 * servidas pela propria aplicacao justamente por isso, e entram na lista pelo
 * mesmo motivo que os motores: a etiqueta sai em milimetro real, e a face que
 * falta muda a largura do texto dentro dela.
 *
 * O arquivo de metadados e os icones entram na lista uma vez so. O primeiro e
 * inscrito pelo proprio plugin, entao fica fora do varredor de arquivos; os
 * segundos vem do varredor, entao a inscricao automatica deles fica desligada.
 *
 * A troca de versao nao e automatica, e o registro fica com o codigo-fonte:
 * `src/pwa/registerServiceWorker.js` chama o registro gerado e acende o aviso
 * na tela, em vez de recarregar a pagina por conta propria.
 */
const PWA_OPTIONS = {
  registerType: 'prompt',
  injectRegister: null,
  manifest: appManifest,
  manifestFilename: 'manifest.webmanifest',
  includeManifestIcons: false,
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
  },
  devOptions: {
    enabled: false,
  },
};

export default defineConfig({
  plugins: [react(), VitePWA(PWA_OPTIONS)],
  build: {
    rollupOptions: {
      external: UNUSED_PDF_MODULES,
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
        },
      },
    },
  },
});
