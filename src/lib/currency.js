const CENTAVOS_PER_UNIT = 100;

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const UNBREAKABLE_SPACES = /[\u00a0\u202f]/g;
const CURRENCY_PREFIX = /R\$/gi;
const ACCEPTED_INPUT = /^-?[\d.,]+$/;
const ONLY_DIGITS = /^\d*$/;
const SEPARATORS = /[.,]/g;

function detectDecimalSeparator(value) {
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');

  if (lastComma === -1 && lastDot === -1) {
    return null;
  }

  if (lastComma > lastDot) {
    return ',';
  }

  if (lastComma !== -1) {
    return '.';
  }

  // So ha pontos: um grupo final de exatamente tres digitos e separador de milhar
  // ("1.234"), qualquer outro tamanho e casa decimal ("99.90", "1799.0000").
  const groups = value.split('.');
  return groups[groups.length - 1].length === 3 ? null : '.';
}

function toCentavos(value, separator) {
  let integerPart;
  let fractionPart;

  if (separator === null) {
    integerPart = value.replace(SEPARATORS, '');
    fractionPart = '';
  } else {
    const index = value.lastIndexOf(separator);
    integerPart = value.slice(0, index).replace(SEPARATORS, '');
    fractionPart = value.slice(index + 1).replace(SEPARATORS, '');
  }

  if (!ONLY_DIGITS.test(integerPart) || !ONLY_DIGITS.test(fractionPart)) {
    return null;
  }

  if (integerPart === '' && fractionPart === '') {
    return null;
  }

  const fraction = fractionPart.padEnd(3, '0');
  const truncated = Number(`${integerPart || '0'}${fraction.slice(0, 2)}`);

  if (!Number.isSafeInteger(truncated)) {
    return null;
  }

  return Number(fraction[2]) >= 5 ? truncated + 1 : truncated;
}

/**
 * Converte um preco digitado ou importado para um inteiro em centavos.
 * Aceita o formato brasileiro ("R$ 1.234,56"), o formato de maquina das notas
 * fiscais ("1799.0000") e numeros. Retorna null quando a entrada nao representa
 * um valor monetario.
 *
 * Quando a origem do dado ja garante o separador decimal, passe-o em
 * `options.decimalSeparator` para evitar a deteccao automatica.
 */
export function normalizePriceToCentavos(input, options = {}) {
  const { decimalSeparator = 'auto' } = options;

  if (input === null || input === undefined || typeof input === 'boolean') {
    return null;
  }

  let raw;

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      return null;
    }
    raw = input.toFixed(10);
  } else {
    raw = String(input)
      .replace(UNBREAKABLE_SPACES, ' ')
      .replace(CURRENCY_PREFIX, '')
      .replace(/\s+/g, '');
  }

  if (!ACCEPTED_INPUT.test(raw)) {
    return null;
  }

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;

  const forcedSeparator = typeof input === 'number' ? '.' : decimalSeparator;
  const separator =
    forcedSeparator === '.' || forcedSeparator === ','
      ? forcedSeparator
      : detectDecimalSeparator(unsigned);

  const centavos = toCentavos(unsigned, separator);

  if (centavos === null) {
    return null;
  }

  return negative ? -centavos : centavos;
}

/**
 * Formata um inteiro em centavos para exibicao em pt-BR ("R$ 1.234,56").
 * Retorna null quando o valor nao e um inteiro.
 */
export function formatCentavosAsBRL(centavos) {
  if (!Number.isInteger(centavos)) {
    return null;
  }

  return BRL_FORMATTER.format(centavos / CENTAVOS_PER_UNIT).replace(UNBREAKABLE_SPACES, ' ');
}
