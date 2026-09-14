/**
 * Unico ponto do projeto que nomeia a biblioteca de codigo de barras.
 *
 * A importacao nomeada a partir do ponto de entrada generico e o que permite ao
 * empacotador descartar as demais simbologias: os atalhos de alto nivel da
 * biblioteca resolvem a simbologia por nome em tempo de execucao e arrastam a
 * tabela inteira junto, multiplicando o pacote por seis.
 *
 * Este modulo e carregado sob demanda por `barcode.js`, o que o mantem fora do
 * pacote inicial da pagina: quem abre o cadastro de produtos nao paga por ele.
 */

import { drawingSVG, qrcode } from 'bwip-js/generic';

export { drawingSVG, qrcode };
