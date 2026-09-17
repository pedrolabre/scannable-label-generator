import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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

export default defineConfig({
  plugins: [react()],
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
