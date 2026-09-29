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
 *
 * O limite de tempo de cada caso e 30 s para a suite inteira, e nao os 5 s do
 * padrao. A suite roda os arquivos em paralelo, e o mesmo caso que leva 2 s
 * sozinho passa de 5 s quando o computador esta ocupado com os vizinhos: a
 * listagem com milhares de produtos no jsdom, o PDF, o simbolo no teto e os
 * lotes de centenas de milhares de registros. Um limite que estoura por carga da
 * maquina nao prova nada sobre o codigo. Os poucos casos que precisam de mais
 * que isso declaram o proprio limite no terceiro argumento do `it`.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    testTimeout: 30_000,
  },
});
