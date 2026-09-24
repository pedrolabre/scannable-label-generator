/**
 * Falhas do motor de geracao do simbolo 2D. O motor lanca em vez de devolver
 * nulo: quem esqueceu de perguntar antes se o codigo era codificavel falha
 * alto, e nao imprime uma etiqueta sem simbolo.
 *
 * A biblioteca de codigo de barras relata seus proprios erros em ingles e com
 * numero interno de rotina. Nada disso chega ao usuario: o erro sai daqui ja
 * com codigo de maquina e frase em portugues.
 */

import {
  SYMBOL_CONTENT_ERROR_CODES,
  SymbolContentError,
} from '../domain/services/symbolContent.js';

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

const CONTENT_ERROR_CODES = Object.freeze({
  [SYMBOL_CONTENT_ERROR_CODES.MISSING_FIELD]: BARCODE_ERROR_CODES.EMPTY_CODE,
  [SYMBOL_CONTENT_ERROR_CODES.UNSAFE_CHARACTER]: BARCODE_ERROR_CODES.UNSUPPORTED_CHARACTER,
  [SYMBOL_CONTENT_ERROR_CODES.INVALID_COPY]: BARCODE_ERROR_CODES.UNSUPPORTED_CHARACTER,
  [SYMBOL_CONTENT_ERROR_CODES.TOO_LONG]: BARCODE_ERROR_CODES.CODE_TOO_LONG,
});

/**
 * Traduz a recusa do contrato do texto do simbolo para a falha do motor, com a
 * mesma frase. Quem desenha a etiqueta trata uma falha so, venha ela do texto
 * ou do desenho.
 */
export function toBarcodeError(error) {
  if (error instanceof SymbolContentError) {
    return new BarcodeError(CONTENT_ERROR_CODES[error.code], error.message);
  }

  return error;
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
