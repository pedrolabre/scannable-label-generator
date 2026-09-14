/**
 * Falhas do motor de geracao do simbolo 2D. O motor lanca em vez de devolver
 * nulo: quem esqueceu de perguntar antes se o codigo era codificavel falha
 * alto, e nao imprime uma etiqueta sem simbolo.
 *
 * A biblioteca de codigo de barras relata seus proprios erros em ingles e com
 * numero interno de rotina. Nada disso chega ao usuario: o erro sai daqui ja
 * com codigo de maquina e frase em portugues.
 */

export const BARCODE_ERROR_CODES = Object.freeze({
  EMPTY_CODE: 'EMPTY_CODE',
  UNSUPPORTED_CHARACTER: 'UNSUPPORTED_CHARACTER',
  CODE_TOO_LONG: 'CODE_TOO_LONG',
  INVALID_SIZE: 'INVALID_SIZE',
  ENGINE_FAILURE: 'ENGINE_FAILURE',
});

export class BarcodeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BarcodeError';
    this.code = code;
  }
}

const UNEXPECTED_FAILURE_MESSAGE =
  'Não foi possível gerar o símbolo deste produto. Confira o código do sistema e tente de novo.';

/**
 * Traduz a falha para o texto que o usuario le ao lado da etiqueta. O que o
 * proprio motor recusou ja tem motivo escrito; qualquer outra excecao cai no
 * texto geral, para que uma falha inesperada do navegador nao apareca como
 * mensagem tecnica.
 */
export function describeBarcodeError(error) {
  if (error instanceof BarcodeError) {
    return error.message;
  }

  return UNEXPECTED_FAILURE_MESSAGE;
}
