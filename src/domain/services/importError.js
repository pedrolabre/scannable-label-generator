/**
 * Falha de formato de um arquivo do lote: o conteudo nao pode ser lido como
 * CSV, JSON ou XML de NFC-e. A mensagem ja nasce no texto que o usuario le, ao
 * lado do nome do arquivo, e a recusa vale para aquele arquivo apenas — os
 * demais do mesmo lote seguem sendo lidos.
 */
export class ImportFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportFormatError';
  }
}

const UNEXPECTED_FAILURE_MESSAGE =
  'Não foi possível ler este arquivo. Confira se ele não está corrompido e tente de novo.';

/**
 * Traduz a falha de um arquivo para o texto exibido na lista do lote. O que o
 * proprio importador recusou ja tem motivo escrito; qualquer outra excecao cai
 * no texto geral, para que uma falha inesperada do navegador nao apareca como
 * mensagem tecnica.
 */
export function describeImportFileError(error) {
  if (error instanceof ImportFormatError) {
    return error.message;
  }

  return UNEXPECTED_FAILURE_MESSAGE;
}
