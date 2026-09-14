/**
 * Contrato da simbologia do produto: o que e gerado, com qual robustez, e qual
 * codigo cabe dentro dela.
 *
 * A simbologia e constante da aplicacao, e nao configuracao de modelo de
 * etiqueta. O aplicativo que fotografa a etiqueta impressa precisa saber de
 * antemao o que procurar; simbologia variavel por modelo tornaria a leitura
 * ambigua e quebraria a previsibilidade das zonas fixas da etiqueta.
 *
 * O nivel Q recupera 25% do simbolo danificado. Ate 16 caracteres de
 * `A-Z 0-9 -` o simbolo continua na versao 1 (21 modulos por lado) em qualquer
 * nivel, entao Q e o nivel mais alto que ainda cobre todo codigo realista sem
 * aumentar a contagem de modulos.
 */

export const BARCODE_SYMBOLOGY = 'qrcode';
export const BARCODE_ERROR_CORRECTION_LEVEL = 'Q';

/** Modulos brancos obrigatorios em cada lado do simbolo. */
export const BARCODE_QUIET_ZONE_MODULES = 4;

/** Unidades de desenho que a biblioteca emite para cada modulo do simbolo. */
export const BARCODE_MODULE_UNITS = 2;

/**
 * Conjunto aceito pelo `systemCode` do produto. Repetido aqui de proposito: o
 * motor do simbolo precisa ser total mesmo quando chamado com um valor que nao
 * passou pelo contrato do produto.
 */
const SUPPORTED_CHARACTERS = /^[0-9A-Za-z-]+$/;

const NUMERIC_ONLY = /^[0-9]+$/;
const ALPHANUMERIC_ONLY = /^[0-9A-Z-]+$/;

/**
 * Capacidade maxima do simbolo no nivel Q, por modo de codificacao. O modo e
 * escolhido pelo conteudo: so digitos usam o modo numerico; letras maiusculas,
 * digitos e hifen usam o modo alfanumerico; uma unica letra minuscula obriga o
 * modo de bytes e derruba a capacidade.
 */
export const MAX_NUMERIC_LENGTH = 3993;
export const MAX_ALPHANUMERIC_LENGTH = 2420;
export const MAX_BYTE_LENGTH = 1663;

export const SYSTEM_CODE_SUPPORT_REASONS = Object.freeze({
  EMPTY: 'EMPTY',
  UNSUPPORTED_CHARACTER: 'UNSUPPORTED_CHARACTER',
  TOO_LONG: 'TOO_LONG',
});

/**
 * Comprimento maximo garantido para este codigo, conforme o modo que o
 * conteudo escolhe. Para um codigo que mistura minuscula com trechos longos de
 * digitos o limite real da simbologia e maior, porque ela alterna de modo no
 * meio da cadeia: este numero e piso garantido, nao teto exato.
 */
export function maxSystemCodeLength(systemCode) {
  if (NUMERIC_ONLY.test(systemCode)) {
    return MAX_NUMERIC_LENGTH;
  }

  if (ALPHANUMERIC_ONLY.test(systemCode)) {
    return MAX_ALPHANUMERIC_LENGTH;
  }

  return MAX_BYTE_LENGTH;
}

/**
 * Responde se o codigo cabe no simbolo sem gerar simbolo nenhum. O contrato do
 * produto aceita `systemCode` de qualquer comprimento, entao comprimento e a
 * unica porta por onde a impossibilidade entra: todo caractere aceito pelo
 * contrato e codificavel.
 */
export function describeSystemCodeSupport(systemCode) {
  if (typeof systemCode !== 'string' || systemCode.length === 0) {
    return { supported: false, reason: SYSTEM_CODE_SUPPORT_REASONS.EMPTY, maxLength: 0 };
  }

  if (!SUPPORTED_CHARACTERS.test(systemCode)) {
    return {
      supported: false,
      reason: SYSTEM_CODE_SUPPORT_REASONS.UNSUPPORTED_CHARACTER,
      maxLength: 0,
    };
  }

  const maxLength = maxSystemCodeLength(systemCode);

  if (systemCode.length > maxLength) {
    return { supported: false, reason: SYSTEM_CODE_SUPPORT_REASONS.TOO_LONG, maxLength };
  }

  return { supported: true, reason: null, maxLength };
}

export function canEncodeSystemCode(systemCode) {
  return describeSystemCodeSupport(systemCode).supported;
}
