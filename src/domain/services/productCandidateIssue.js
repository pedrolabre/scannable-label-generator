/**
 * Vocabulario dos avisos do mapeamento.
 *
 * Um aviso nasce quando o campo cru nao consegue virar o campo do produto: o
 * mapeamento nunca inventa valor e nunca descarta em silencio, entao ou entrega
 * um valor que o contrato aceita, ou omite o campo e deixa aqui o motivo — ja
 * escrito em portugues, pronto para aparecer ao lado da origem do registro.
 *
 * As duas severidades separam as duas leituras possiveis:
 *
 * - `notice`  o campo tem valor, mas merece conferencia — o nome encurtado e o
 *             unico caso hoje;
 * - `missing` o campo ficou de fora e o contrato vai cobra-lo; o aviso explica
 *             por que ele nao pode ser preenchido a partir do arquivo.
 *
 * `rawValue` guarda o texto como veio do arquivo. E ele que responde a pergunta
 * "mas o meu arquivo diz o que?" sem obrigar a reabrir o arquivo.
 */

export const ISSUE_SEVERITY_NOTICE = 'notice';
export const ISSUE_SEVERITY_MISSING = 'missing';

export const ISSUE_DISPLAY_NAME_TRUNCATED = 'displayNameTruncated';
export const ISSUE_PRICE_NOT_UNITARY = 'priceNotUnitary';
export const ISSUE_PRICE_UNREADABLE = 'priceUnreadable';
export const ISSUE_PRICE_NEGATIVE = 'priceNegative';
export const ISSUE_EAN_UNEXPECTED_LENGTH = 'eanUnexpectedLength';

export function createMappingIssue({ field, code, severity, rawValue, message }) {
  return { field, code, severity, rawValue, message };
}

/**
 * Lista compartilhada para o caso comum — a grande maioria dos registros nao
 * tem aviso nenhum, e um lote de centenas de milhares de linhas nao precisa de
 * um array vazio proprio para cada um.
 */
export const NO_MAPPING_ISSUES = Object.freeze([]);
