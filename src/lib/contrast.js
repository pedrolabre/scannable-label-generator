/**
 * Razao de contraste entre duas cores.
 *
 * A conta e a da recomendacao de acessibilidade para conteudo web: cada canal
 * volta de sRGB para luz linear, a luminancia relativa sai da soma ponderada
 * dos tres, e a razao compara a mais clara com a mais escura somando o mesmo
 * deslocamento as duas. Sao quinze linhas de aritmetica inteiramente
 * especificada, e e por isso que elas moram aqui em vez de virem de fora: as
 * bibliotecas de conferencia medem o documento ja desenhado pelo navegador, e
 * o ambiente da suite nao calcula posicao nem resolve cor.
 *
 * A funcao nao conhece a interface: ela recebe duas cores e devolve um numero.
 * Quais pares importam e o que cada um precisa cumprir e assunto de quem
 * confere.
 */

const SHORT_HEX_LENGTH = 3;
const FULL_HEX_LENGTH = 6;
const MAX_CHANNEL = 255;

// Abaixo deste ponto a curva de sRGB e uma reta; acima dela e a potencia.
const LINEAR_THRESHOLD = 0.03928;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_DIVISOR = 1.055;
const GAMMA_EXPONENT = 2.4;

// Peso de cada canal na luminancia percebida, e o deslocamento que evita a
// divisao por zero quando uma das cores e o preto absoluto.
const CHANNEL_WEIGHTS = Object.freeze([0.2126, 0.7152, 0.0722]);
const LUMINANCE_OFFSET = 0.05;

/**
 * Limiares nomeados, para que quem confere cite o criterio em vez do numero.
 */
export const CONTRAST_MINIMUM = Object.freeze({
  text: 4.5,
  largeText: 3,
  nonText: 3,
});

export class ContrastError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContrastError';
  }
}

/**
 * Aceita `#abc` e `#aabbcc`, com ou sem o sinal, em qualquer caixa. Qualquer
 * outra coisa e recusada: uma cor mal escrita que virasse preto silencioso
 * daria um contraste otimo e uma conferencia falsa.
 */
export function parseHexColor(value) {
  if (typeof value !== 'string') {
    throw new ContrastError('A cor precisa ser um texto no formato hexadecimal.');
  }

  const digits = value.trim().replace(/^#/, '');

  if (!/^[0-9a-fA-F]+$/.test(digits)) {
    throw new ContrastError(`Cor hexadecimal invalida: ${value}`);
  }

  if (digits.length === SHORT_HEX_LENGTH) {
    return Array.from(digits, (digit) => Number.parseInt(digit + digit, 16));
  }

  if (digits.length === FULL_HEX_LENGTH) {
    return [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16));
  }

  throw new ContrastError(`Cor hexadecimal invalida: ${value}`);
}

function toLinearChannel(channel) {
  const normalized = channel / MAX_CHANNEL;

  if (normalized <= LINEAR_THRESHOLD) {
    return normalized / LINEAR_DIVISOR;
  }

  return ((normalized + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA_EXPONENT;
}

export function relativeLuminance(color) {
  return parseHexColor(color)
    .map(toLinearChannel)
    .reduce((total, channel, index) => total + channel * CHANNEL_WEIGHTS[index], 0);
}

export function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);

  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + LUMINANCE_OFFSET) / (darker + LUMINANCE_OFFSET);
}

export function meetsContrast(foreground, background, minimum = CONTRAST_MINIMUM.text) {
  return contrastRatio(foreground, background) >= minimum;
}
