import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Configuracao separada da do empacotador.
 *
 * O plugin de React esta aqui porque a suite passou a cobrir o desenho da
 * etiqueta, e o que se prova nesses testes nao tem como sair de funcao pura: o
 * que a etiqueta mostra enquanto o simbolo carrega e o que ela mostra quando a
 * geracao falha. Todo o resto do calculo da etiqueta continua em funcao pura,
 * conferido sem montar componente.
 *
 * O ambiente padrao e o de DOM porque a leitura de NFC-e usa o `DOMParser` do
 * navegador. Os arquivos que nao precisam dele declaram `@vitest-environment
 * node` no proprio cabecalho e economizam a montagem do ambiente.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
