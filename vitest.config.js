import { defineConfig } from 'vitest/config';

/**
 * Configuracao separada da do empacotador: a suite cobre funcoes puras de
 * leitura de arquivo, sem componente nem JSX, entao nao precisa do plugin de
 * React. O ambiente de DOM e necessario porque a leitura de NFC-e usa o
 * `DOMParser` do navegador.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
  },
});
