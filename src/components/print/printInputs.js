/**
 * Leitura dos campos numericos da tela de impressao.
 *
 * O campo guarda o texto digitado, e nao um numero: enquanto o operador apaga
 * para redigitar o campo passa por estados que nao sao numero nenhum, e coagir
 * cada um deles a um valor faria o campo corrigir sozinho o que ele esta no meio
 * de escrever. A traducao de texto para numero acontece aqui, uma vez, e devolve
 * junto o motivo da recusa.
 *
 * Os tetos sao da tela, e nao do contrato. O contrato recusa o absurdo
 * (quantidade nula, margem negativa, margem que consome a folha); o teto daqui
 * impede que o campo vire um caminho para pedir um milhao de etiquetas ou para
 * produzir uma folha sem area util alguma. Meio milimetro ja esta abaixo da
 * tolerancia de qualquer impressora domestica, entao passo mais fino seria
 * ruido.
 */

export const DEFAULT_COPIES = 1;
export const MAX_COPIES = 999;

export const MILLIMETER_STEP = 0.5;
export const MAX_MARGIN_MM = 50;
export const MAX_GAP_MM = 30;

/** Uma casa decimal em milimetro: o passo e 0,5 mm. */
const MILLIMETER_DECIMALS = 1;

const INTEGER_TEXT = /^-?\d+$/;
const DECIMAL_TEXT = /^-?\d+(?:[.,]\d+)?$/;

/**
 * Os seis campos da folha que o operador ajusta, na ordem em que aparecem na
 * tela. A lista mora aqui porque o rotulo e o teto de cada campo sao a mesma
 * informacao que a leitura precisa para montar a mensagem de recusa.
 */
export const SHEET_FIELDS = Object.freeze([
  Object.freeze({ key: 'marginTopMm', label: 'Margem superior', max: MAX_MARGIN_MM }),
  Object.freeze({ key: 'marginRightMm', label: 'Margem direita', max: MAX_MARGIN_MM }),
  Object.freeze({ key: 'marginBottomMm', label: 'Margem inferior', max: MAX_MARGIN_MM }),
  Object.freeze({ key: 'marginLeftMm', label: 'Margem esquerda', max: MAX_MARGIN_MM }),
  Object.freeze({ key: 'columnGapMm', label: 'Espaçamento entre colunas', max: MAX_GAP_MM }),
  Object.freeze({ key: 'rowGapMm', label: 'Espaçamento entre linhas', max: MAX_GAP_MM }),
]);

/**
 * Ajuste que aproveita a folha: margem de 5 mm nos quatro lados e etiquetas
 * encostadas. Cinco milimetros e a borda que a maior parte das impressoras
 * domesticas e de escritorio ainda imprime; abaixo disso a borda da etiqueta
 * comeca a sair cortada. Sem espacamento, a linha de corte de uma etiqueta e a
 * da vizinha, e o que a folha ganha e uma coluna ou uma linha a mais.
 */
export const COMPACT_SHEET_ADJUSTMENTS = Object.freeze({
  marginTopMm: '5',
  marginRightMm: '5',
  marginBottomMm: '5',
  marginLeftMm: '5',
  columnGapMm: '0',
  rowGapMm: '0',
});

/** Diz se os seis campos estao, como texto, no ajuste que aproveita a folha. */
export function isCompactSheet(adjustments) {
  return SHEET_FIELDS.every(
    ({ key }) =>
      parseMillimeters(adjustments?.[key], { label: '', max: Infinity }).value ===
      Number(COMPACT_SHEET_ADJUSTMENTS[key]),
  );
}

export function findSheetField(key) {
  return SHEET_FIELDS.find((field) => field.key === key) ?? null;
}

/**
 * Quantidade de copias de um produto. Campo vazio nao vira 1 em silencio: quem
 * apagou o numero ainda nao disse quantas quer, e completar por conta seria
 * imprimir uma etiqueta que ninguem pediu.
 */
export function parseCopies(raw) {
  const text = String(raw ?? '').trim();

  if (text === '') {
    return { value: null, error: 'Informe a quantidade de etiquetas' };
  }

  if (!INTEGER_TEXT.test(text)) {
    return { value: null, error: 'Quantidade de etiquetas deve ser um número inteiro' };
  }

  const value = Number(text);

  if (value <= 0) {
    return { value: null, error: 'Quantidade de etiquetas deve ser maior que zero' };
  }

  if (value > MAX_COPIES) {
    return { value: null, error: `Quantidade de etiquetas deve ser no máximo ${MAX_COPIES}` };
  }

  return { value, error: null };
}

/**
 * Medida em milimetro de um campo da folha. Aceita virgula e ponto como
 * separador decimal, e arredonda para uma casa: o passo do campo e 0,5 mm, e
 * guardar mais casas do que o operador consegue ajustar so produziria numeros
 * que ele nao digitou.
 */
export function parseMillimeters(raw, { label, max }) {
  const text = String(raw ?? '').trim();

  if (text === '') {
    return { value: null, error: `${label}: informe um valor em milímetros` };
  }

  if (!DECIMAL_TEXT.test(text)) {
    return { value: null, error: `${label} deve ser um número em milímetros` };
  }

  const value = Number(text.replace(',', '.'));

  if (value < 0) {
    return { value: null, error: `${label} não pode ser negativo` };
  }

  if (value > max) {
    return { value: null, error: `${label} deve ser no máximo ${max} mm` };
  }

  const factor = 10 ** MILLIMETER_DECIMALS;

  return { value: Math.round(value * factor) / factor, error: null };
}

/** Numero em milimetro no formato que o campo de texto exibe. */
export function formatMillimeters(value) {
  return String(value).replace('.', ',');
}
