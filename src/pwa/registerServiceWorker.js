/**
 * Unico arquivo do codigo-fonte que fala com o registro gerado no empacotamento.
 *
 * O modulo importado aqui so existe depois da build, entao nenhum teste o
 * alcanca e nenhum outro arquivo do projeto o importa: o que a tela precisa
 * saber chega por `updateState.js`, que e JavaScript comum.
 *
 * A troca de versao nao acontece sozinha. O trabalho de impressao em preparo
 * vive apenas na memoria da pagina, e um recarregamento automatico o apagaria
 * sem aviso; entao a descoberta so acende o aviso na tela, e quem decide
 * recarregar e o operador.
 */

import { registerSW } from 'virtual:pwa-register';

import { announceUpdate } from './updateState.js';

export function registerServiceWorker() {
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      announceUpdate(() => {
        updateServiceWorker(true);
      });
    },
  });

  return updateServiceWorker;
}
