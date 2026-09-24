/**
 * Contrato da simbologia: o que e gerado, com qual robustez, e quanto texto
 * cabe dentro dela.
 *
 * A simbologia e constante da aplicacao, e nao configuracao de modelo de
 * etiqueta. O aplicativo que fotografa a etiqueta impressa precisa saber de
 * antemao o que procurar; simbologia variavel por modelo tornaria a leitura
 * ambigua.
 *
 * O nivel M recupera 15% do simbolo danificado. O simbolo carrega a etiqueta
 * inteira, e nao so o codigo, e o nivel Q pediria a versao 8 para o mesmo texto
 * que o nivel M acomoda na versao 7: seriam oito modulos a mais por lado numa
 * caixa que nao cresce, e o modulo cairia abaixo do piso de impressao. Entre um
 * simbolo mais robusto que nao se le e um menos robusto que se le, fica o
 * segundo.
 */

export const BARCODE_SYMBOLOGY = 'qrcode';
export const BARCODE_ERROR_CORRECTION_LEVEL = 'M';

/** Modulos brancos obrigatorios em cada lado do simbolo. */
export const BARCODE_QUIET_ZONE_MODULES = 4;

/** Unidades de desenho que a biblioteca emite para cada modulo do simbolo. */
export const BARCODE_MODULE_UNITS = 2;

/**
 * Maior texto aceito, em bytes UTF-8.
 *
 * A versao 7 no nivel M guarda 124 palavras de dados. No modo de bytes o
 * cabecalho gasta 12 bits e cada byte do texto gasta 8, o que da 122 bytes; a
 * declaracao de UTF-8, quando o texto tem acento, gasta mais 12 bits e derruba
 * o limite para 121. Com os dois tetos, nenhum texto aceito passa da versao 7,
 * e e isso que permite dimensionar a caixa do simbolo uma vez so, para o pior
 * caso.
 */
export const MAX_SYMBOL_TEXT_BYTES = 122;
export const MAX_UTF8_SYMBOL_TEXT_BYTES = 121;

/** Lado do maior simbolo aceito, em modulos: versao 7 (45) mais a zona de silencio. */
export const MAX_SYMBOL_MODULES = 45;
export const MAX_SYMBOL_TOTAL_MODULES = MAX_SYMBOL_MODULES + BARCODE_QUIET_ZONE_MODULES * 2;

export const SYMBOL_TEXT_SUPPORT_REASONS = Object.freeze({
  EMPTY: 'EMPTY',
  TOO_LONG: 'TOO_LONG',
});

const encoder = new TextEncoder();
const NON_ASCII = /[^\x00-\x7F]/;

export function symbolTextByteLength(text) {
  return typeof text === 'string' ? encoder.encode(text).length : 0;
}

/**
 * O leitor de QR sem declaracao de conjunto de caracteres le os bytes como
 * Latin-1, e "SOFÁ" em UTF-8 viraria "SOFÃ\u0081". A declaracao so entra
 * quando ha caractere fora do ASCII: o texto sem acento sai identico ao que
 * sairia sem ela, byte a byte.
 */
export function needsUtf8Declaration(text) {
  return typeof text === 'string' && NON_ASCII.test(text);
}

/** Teto do texto informado: menor quando ele leva a declaracao de UTF-8. */
export function maxSymbolTextBytes(text) {
  return needsUtf8Declaration(text) ? MAX_UTF8_SYMBOL_TEXT_BYTES : MAX_SYMBOL_TEXT_BYTES;
}

/** Responde se o texto cabe no simbolo sem gerar simbolo nenhum. */
export function describeSymbolTextSupport(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return {
      supported: false,
      reason: SYMBOL_TEXT_SUPPORT_REASONS.EMPTY,
      byteLength: 0,
      maxBytes: MAX_SYMBOL_TEXT_BYTES,
    };
  }

  const byteLength = symbolTextByteLength(text);
  const maxBytes = maxSymbolTextBytes(text);

  if (byteLength > maxBytes) {
    return { supported: false, reason: SYMBOL_TEXT_SUPPORT_REASONS.TOO_LONG, byteLength, maxBytes };
  }

  return { supported: true, reason: null, byteLength, maxBytes };
}

export function canEncodeSymbolText(text) {
  return describeSymbolTextSupport(text).supported;
}
