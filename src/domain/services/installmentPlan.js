/**
 * Crediario e cartao da etiqueta: o valor da parcela do crediario a partir do
 * preco a vista, e o texto das linhas do crediario e do cartao.
 *
 * Funcao pura, sem DOM e sem armazenamento. A conta e feita em inteiros do
 * comeco ao fim — preco em centavos, taxa em centesimos de ponto percentual —
 * e so a divisao final e arredondada, ao centavo mais proximo. Ponto flutuante
 * no meio do caminho faria uma parcela de R$ 161,98 sair R$ 161,97 num
 * aparelho e R$ 161,98 no outro, e a etiqueta impressa precisa bater com o
 * caixa.
 *
 * A taxa de juros do crediario sai sempre na etiqueta. A parcela so sai quando
 * o operador escolhe como calcula-la:
 *
 * - **Nenhum.** Sem calculo: a etiqueta leva so a taxa, sem valor a prazo.
 * - **Juros simples.** A taxa incide sobre o preco a vista em cada mes:
 *   total = preco x (1 + taxa x parcelas), e a parcela e o total dividido pelas
 *   parcelas. R$ 1.000,00 em 10x a 8% a.m. sao 10 x R$ 180,00.
 * - **Juros compostos.** Parcela fixa da Tabela Price:
 *   preco x taxa / (1 - (1 + taxa) ^ -parcelas). R$ 1.000,00 em 10x a 8% a.m.
 *   sao 10 x R$ 149,03.
 *
 * Taxa zero com juros simples ou compostos divide o preco pelas parcelas.
 *
 * O cartao e sem juros e sai so como texto, com a quantidade de parcelas:
 * "10x sem juros no cartao", sem valor.
 *
 * Com o arredondamento para ,90 ligado, a parcela calculada fica no mesmo real
 * e os centavos passam a ser 90: R$ 161,98 e R$ 161,20 saem os dois R$ 161,90.
 */

import { formatCentavosAsBRL } from '../../lib/currency.js';

export const INSTALLMENT_COUNT_MIN = 2;
export const INSTALLMENT_COUNT_MAX = 24;

/** Taxa em centesimos de ponto percentual: 800 e 8% ao mes. */
export const INTEREST_RATE_MAX = 2000;
const RATE_SCALE = 10000;
const RATE_DECIMALS = 2;

export const INTEREST_MODES = Object.freeze({
  NONE: 'nenhum',
  SIMPLE: 'simples',
  COMPOUND: 'composto',
});

export const INTEREST_MODE_VALUES = Object.freeze(Object.values(INTEREST_MODES));

export const INSTALLMENT_COUNT_MESSAGE = `A quantidade de parcelas deve ser um número inteiro entre ${INSTALLMENT_COUNT_MIN} e ${INSTALLMENT_COUNT_MAX}.`;
export const INTEREST_RATE_EMPTY_MESSAGE = 'Informe a taxa de juros ao mês, como 8 ou 2,5.';
export const INTEREST_RATE_DECIMALS_MESSAGE = 'A taxa de juros aceita no máximo duas casas decimais.';
export const INTEREST_RATE_RANGE_MESSAGE = `A taxa de juros deve ficar entre 0% e ${INTEREST_RATE_MAX / 100}% ao mês.`;

const NINETY_CENTAVOS = 90;
const CENTAVOS_PER_REAL = 100;

/** Divisao de inteiros positivos arredondada ao mais proximo, metade para cima. */
function roundedDivision(numerator, denominator) {
  return (2n * numerator + denominator) / (2n * denominator);
}

function exactInstallment(price, count, interest, rate) {
  if (rate === 0) {
    return roundedDivision(price, count);
  }

  const scale = BigInt(RATE_SCALE);
  const r = BigInt(rate);

  if (interest === INTEREST_MODES.SIMPLE) {
    return roundedDivision(price * (scale + r * count), scale * count);
  }

  const grown = (scale + r) ** count;
  const base = scale ** count;

  return roundedDivision(price * r * grown, scale * (grown - base));
}

/** Mesmo real, centavos 90. */
export function roundToNinety(centavos) {
  return Math.floor(centavos / CENTAVOS_PER_REAL) * CENTAVOS_PER_REAL + NINETY_CENTAVOS;
}

/**
 * Parcela do crediario para o preco informado, ou nulo quando nao ha o que
 * calcular: calculo `Nenhum`, preco ausente ou nao positivo, quantidade ou taxa
 * fora dos limites, ou parcela que nao chega a um centavo antes do
 * arredondamento para ,90.
 */
export function computeInstallmentPlan({
  priceInCentavos,
  installments,
  interest = INTEREST_MODES.SIMPLE,
  rateHundredths = 0,
  roundToNinetyCents = false,
}) {
  if (!Number.isSafeInteger(priceInCentavos) || priceInCentavos <= 0) {
    return null;
  }

  if (
    !Number.isInteger(installments) ||
    installments < INSTALLMENT_COUNT_MIN ||
    installments > INSTALLMENT_COUNT_MAX ||
    !Number.isInteger(rateHundredths) ||
    rateHundredths < 0 ||
    rateHundredths > INTEREST_RATE_MAX ||
    interest === INTEREST_MODES.NONE ||
    !INTEREST_MODE_VALUES.includes(interest)
  ) {
    return null;
  }

  const exact = Number(
    exactInstallment(BigInt(priceInCentavos), BigInt(installments), interest, rateHundredths),
  );

  if (exact < 1) {
    return null;
  }

  return Object.freeze({
    installments,
    installmentCentavos: roundToNinetyCents ? roundToNinety(exact) : exact,
    rateHundredths,
  });
}

/** Taxa em texto pt-BR, sem zeros sobrando: 800 e "8%", 250 e "2,5%". */
export function formatInterestRate(rateHundredths) {
  const whole = Math.floor(rateHundredths / 100);
  const fraction = String(rateHundredths % 100).padStart(RATE_DECIMALS, '0').replace(/0+$/, '');

  return fraction === '' ? `${whole}%` : `${whole},${fraction}%`;
}

/** Linha da parcela do crediario na etiqueta: "Crediário: 10x de R$ 180,00". */
export function describeInstallmentText(plan) {
  return `Crediário: ${plan.installments}x de ${formatCentavosAsBRL(plan.installmentCentavos)}`;
}

/** Linha da taxa do crediario na etiqueta: "Taxa de Juros: 8% a.m.". */
export function describeRateText(rateHundredths) {
  return `Taxa de Juros: ${formatInterestRate(rateHundredths)} a.m.`;
}

/** Linha do cartao na etiqueta: "10x sem juros no cartão". */
export function describeCardText(installments) {
  return `${installments}x sem juros no cartão`;
}

/**
 * Le a taxa digitada pelo operador — "8", "2,5", "1.99", "8%" — e devolve em
 * centesimos de ponto percentual. Lanca com a frase do caso quando nao da.
 */
export function parseInterestRate(input) {
  const text = typeof input === 'string' ? input.trim().replace(/%$/, '').trim() : '';

  if (text === '') {
    throw new Error(INTEREST_RATE_EMPTY_MESSAGE);
  }

  const match = /^(\d+)(?:[.,](\d*))?$/.exec(text);

  if (!match) {
    throw new Error(INTEREST_RATE_EMPTY_MESSAGE);
  }

  const [, whole, fraction = ''] = match;

  if (fraction.length > RATE_DECIMALS) {
    throw new Error(INTEREST_RATE_DECIMALS_MESSAGE);
  }

  const value = Number(whole) * 100 + Number(fraction.padEnd(RATE_DECIMALS, '0'));

  if (!Number.isSafeInteger(value) || value > INTEREST_RATE_MAX) {
    throw new Error(INTEREST_RATE_RANGE_MESSAGE);
  }

  return value;
}

/** Le a quantidade de parcelas digitada. Lanca com a frase do caso quando nao da. */
export function parseInstallmentCount(input) {
  const text = typeof input === 'string' ? input.trim().replace(/x$/i, '').trim() : '';

  if (!/^\d+$/.test(text)) {
    throw new Error(INSTALLMENT_COUNT_MESSAGE);
  }

  const value = Number(text);

  if (value < INSTALLMENT_COUNT_MIN || value > INSTALLMENT_COUNT_MAX) {
    throw new Error(INSTALLMENT_COUNT_MESSAGE);
  }

  return value;
}
