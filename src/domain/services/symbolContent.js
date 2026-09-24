/**
 * Contrato do texto gravado no simbolo da etiqueta.
 *
 * O simbolo carrega a etiqueta inteira, e nao so o codigo: quem fotografa a
 * etiqueta precisa identificar o produto e contar o exemplar sem rede e sem
 * consultar banco nenhum. O texto e posicional, com barra vertical entre os
 * campos, e a ordem nunca muda:
 *
 *   [0] versao do contrato, fixa em `LF1`
 *   [1] codigo do sistema
 *   [2] nome da etiqueta
 *   [3] preco em centavos, inteiro
 *   [4] codigo de barras, opcional
 *   [5] NCM, opcional
 *   [6] exemplar: `c1`, `c2`, ... na ordem da copia dentro da tiragem
 *
 *   LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1
 *   LF1|118789|CANTINHO CAFE RUBI|85990|||c1
 *
 * Campo opcional ausente mantem a posicao, vazio. Quem le faz `split('|')` e
 * trata texto vazio como ausente. Nao ha escape: um separador dentro de um
 * campo mudaria a posicao de todos os seguintes, e por isso o contrato do
 * produto recusa barra vertical e quebra de linha no nome antes de o texto
 * chegar aqui. Esta funcao confere de novo, porque e ela que responde pelo
 * texto que sai impresso.
 *
 * A numeracao do exemplar recomeca a cada tiragem. Reimprimir a etiqueta de uma
 * peca produz outro `c1` do mesmo produto; o texto nao distingue as duas
 * impressoes.
 *
 * Este modulo e o unico lugar em que o texto e montado. A previa da etiqueta,
 * a folha e o arquivo impresso chamam esta funcao, e o aplicativo leitor le o
 * que ela escreve.
 */

import {
  SYMBOL_TEXT_SUPPORT_REASONS,
  describeSymbolTextSupport,
} from '../../lib/barcodeSymbology.js';

export const SYMBOL_CONTRACT_VERSION = 'LF1';
export const SYMBOL_FIELD_SEPARATOR = '|';
export const SYMBOL_COPY_PREFIX = 'c';

export const SYMBOL_FIELDS = Object.freeze([
  'version',
  'systemCode',
  'displayName',
  'priceInCentavos',
  'ean',
  'ncm',
  'copy',
]);

/** Separador e qualquer caractere de controle, inclusive quebra de linha. */
export const SYMBOL_UNSAFE_CHARACTERS = /[|\u0000-\u001F\u007F]/;

export const SYMBOL_CONTENT_ERROR_CODES = Object.freeze({
  MISSING_FIELD: 'MISSING_FIELD',
  UNSAFE_CHARACTER: 'UNSAFE_CHARACTER',
  INVALID_COPY: 'INVALID_COPY',
  TOO_LONG: 'TOO_LONG',
});

export class SymbolContentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SymbolContentError';
    this.code = code;
  }
}

const FIELD_LABELS = Object.freeze({
  systemCode: 'código do sistema',
  displayName: 'nome da etiqueta',
  ean: 'código de barras',
  ncm: 'NCM',
});

function requiredText(product, field) {
  const value = product?.[field];

  if (typeof value !== 'string' || value.length === 0) {
    throw new SymbolContentError(
      SYMBOL_CONTENT_ERROR_CODES.MISSING_FIELD,
      `O ${FIELD_LABELS[field]} está vazio, e sem ele não há símbolo para imprimir.`,
    );
  }

  return safeText(value, field);
}

function optionalText(product, field) {
  const value = product?.[field];

  return typeof value === 'string' && value.length > 0 ? safeText(value, field) : '';
}

function safeText(value, field) {
  if (SYMBOL_UNSAFE_CHARACTERS.test(value)) {
    throw new SymbolContentError(
      SYMBOL_CONTENT_ERROR_CODES.UNSAFE_CHARACTER,
      `O ${FIELD_LABELS[field]} tem barra vertical ou quebra de linha, que o símbolo não aceita.`,
    );
  }

  return value;
}

function priceText(product) {
  const value = product?.priceInCentavos;

  if (!Number.isInteger(value) || value < 0) {
    throw new SymbolContentError(
      SYMBOL_CONTENT_ERROR_CODES.MISSING_FIELD,
      'O preço não é um valor válido, e sem ele não há símbolo para imprimir.',
    );
  }

  return String(value);
}

/** `c1`, `c2`, ... O exemplar comeca em 1. */
export function formatCopyId(copyNumber) {
  if (!Number.isInteger(copyNumber) || copyNumber < 1) {
    throw new SymbolContentError(
      SYMBOL_CONTENT_ERROR_CODES.INVALID_COPY,
      'O número do exemplar precisa ser um inteiro a partir de 1.',
    );
  }

  return `${SYMBOL_COPY_PREFIX}${copyNumber}`;
}

/**
 * Texto do simbolo de um exemplar. Lanca `SymbolContentError` quando o produto
 * nao produz um texto que o contrato aceite ou que caiba no simbolo.
 */
export function buildSymbolText(product, copyNumber) {
  const text = [
    SYMBOL_CONTRACT_VERSION,
    requiredText(product, 'systemCode'),
    requiredText(product, 'displayName'),
    priceText(product),
    optionalText(product, 'ean'),
    optionalText(product, 'ncm'),
    formatCopyId(copyNumber),
  ].join(SYMBOL_FIELD_SEPARATOR);

  const support = describeSymbolTextSupport(text);

  if (support.reason === SYMBOL_TEXT_SUPPORT_REASONS.TOO_LONG) {
    throw new SymbolContentError(
      SYMBOL_CONTENT_ERROR_CODES.TOO_LONG,
      `O conteúdo do símbolo tem ${support.byteLength} bytes e o limite é ${support.maxBytes}. ` +
        'Encurte o nome da etiqueta ou o código do sistema.',
    );
  }

  return text;
}

/**
 * Responde, sem gerar desenho, se o exemplar informado tem simbolo. O exemplar
 * de numero mais alto e o de texto mais longo, entao conferir a ultima copia da
 * tiragem responde pela tiragem inteira.
 */
export function describeProductSymbolSupport(product, copyNumber = 1) {
  try {
    return { supported: true, text: buildSymbolText(product, copyNumber), error: null };
  } catch (error) {
    if (error instanceof SymbolContentError) {
      return { supported: false, text: null, error };
    }

    throw error;
  }
}

/** Leitura do texto de volta em campos, na forma que o aplicativo leitor usa. */
export function parseSymbolText(text) {
  const parts = String(text).split(SYMBOL_FIELD_SEPARATOR);

  return Object.fromEntries(SYMBOL_FIELDS.map((field, index) => [field, parts[index] ?? '']));
}
