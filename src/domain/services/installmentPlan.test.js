// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  INSTALLMENT_COUNT_MESSAGE,
  INTEREST_MODES,
  INTEREST_RATE_DECIMALS_MESSAGE,
  INTEREST_RATE_EMPTY_MESSAGE,
  INTEREST_RATE_RANGE_MESSAGE,
  computeInstallmentPlan,
  describeCardText,
  describeInstallmentText,
  describeRateText,
  formatInterestRate,
  parseInstallmentCount,
  parseInterestRate,
  roundToNinety,
} from './installmentPlan.js';

const { NONE, SIMPLE, COMPOUND } = INTEREST_MODES;

function installment(priceInCentavos, installments, interest, rateHundredths, roundToNinetyCents = false) {
  return computeInstallmentPlan({ priceInCentavos, installments, interest, rateHundredths, roundToNinetyCents })
    ?.installmentCentavos;
}

describe('juros simples', () => {
  it('R$ 1.000,00 em 10x a 8% a.m.', () => {
    // 1.000,00 x (1 + 0,08 x 10) = 1.800,00; 1.800,00 / 10 = 180,00.
    expect(installment(100000, 10, SIMPLE, 800)).toBe(18000);
  });

  it('R$ 899,90 em 10x a 8% a.m.', () => {
    // 899,90 x 1,8 = 1.619,82; 1.619,82 / 10 = 161,982, que fica 161,98.
    expect(installment(89990, 10, SIMPLE, 800)).toBe(16198);
  });

  it('um centavo em 2x a 20% a.m.', () => {
    // 0,01 x (1 + 0,20 x 2) = 0,014; 0,014 / 2 = 0,007, que fica 0,01.
    expect(installment(1, 2, SIMPLE, 2000)).toBe(1);
  });

  it('nao parcela o que nao chega a um centavo por parcela', () => {
    // 0,01 x 1,8 / 10 = 0,0018.
    expect(computeInstallmentPlan({ priceInCentavos: 1, installments: 10, interest: SIMPLE, rateHundredths: 800 })).toBeNull();
  });

  it('2 e 24 parcelas, nas pontas do limite', () => {
    // 1.000,00 x (1 + 0,08 x 2) / 2 = 580,00.
    expect(installment(100000, 2, SIMPLE, 800)).toBe(58000);
    // 1.000,00 x (1 + 0,02 x 24) / 24 = 1.480,00 / 24 = 61,6666..., que fica 61,67.
    expect(installment(100000, 24, SIMPLE, 200)).toBe(6167);
  });
});

describe('juros compostos (Tabela Price)', () => {
  it('R$ 1.000,00 em 10x a 8% a.m.', () => {
    // 1.000,00 x 0,08 / (1 - 1,08^-10) = 80 / 0,536806... = 149,029..., que fica 149,03.
    expect(installment(100000, 10, COMPOUND, 800)).toBe(14903);
  });

  it('R$ 899,90 em 10x a 8% a.m.', () => {
    // 899,90 x 0,08 / 0,536806... = 71,992 / 0,536806... = 134,112..., que fica 134,11.
    expect(installment(89990, 10, COMPOUND, 800)).toBe(13411);
  });

  it('um centavo em 2x a 20% a.m.', () => {
    // 0,01 x 0,2 x 1,44 / 0,44 = 0,006545..., que fica 0,01.
    expect(installment(1, 2, COMPOUND, 2000)).toBe(1);
  });

  it('2 e 24 parcelas, nas pontas do limite', () => {
    // 1.000,00 x 0,08 x 1,1664 / 0,1664 = 560,769..., que fica 560,77.
    expect(installment(100000, 2, COMPOUND, 800)).toBe(56077);
    // 1.000,00 x 0,0199 / (1 - 1,0199^-24) = 52,808..., que fica 52,81.
    expect(installment(100000, 24, COMPOUND, 199)).toBe(5281);
  });
});

describe('sem calculo e taxa zero', () => {
  it('Nenhum nao calcula parcela nenhuma', () => {
    expect(
      computeInstallmentPlan({ priceInCentavos: 100000, installments: 10, interest: NONE, rateHundredths: 800 }),
    ).toBeNull();
  });

  it('taxa zero com juros simples ou compostos divide o preco pelas parcelas', () => {
    for (const interest of [SIMPLE, COMPOUND]) {
      // 1.000,00 / 3 = 333,333..., que fica 333,33.
      expect(installment(100000, 3, interest, 0)).toBe(33333);
    }
  });

  it('arredonda a metade do centavo para cima', () => {
    // 0,05 / 2 = 0,025, que fica 0,03.
    expect(installment(5, 2, SIMPLE, 0)).toBe(3);
  });
});

describe('arredondamento para ,90', () => {
  it('mantem o real e troca os centavos por 90', () => {
    expect(roundToNinety(16198)).toBe(16190);
    expect(roundToNinety(16120)).toBe(16190);
    expect(roundToNinety(18000)).toBe(18090);
    expect(roundToNinety(16190)).toBe(16190);
    expect(roundToNinety(5)).toBe(90);
  });

  it('vale depois da conta, com a caixa ligada', () => {
    expect(installment(89990, 10, SIMPLE, 800, true)).toBe(16190);
    expect(installment(89990, 10, SIMPLE, 800, false)).toBe(16198);
  });
});

describe('limites', () => {
  it('nao calcula fora dos limites nem sem preco', () => {
    expect(installment(100000, 1, SIMPLE, 800)).toBeUndefined();
    expect(installment(100000, 25, SIMPLE, 800)).toBeUndefined();
    expect(installment(100000, 10, SIMPLE, 2001)).toBeUndefined();
    expect(installment(100000, 10, SIMPLE, -1)).toBeUndefined();
    expect(installment(100000, 10, 'outro', 800)).toBeUndefined();
    expect(installment(0, 10, SIMPLE, 800)).toBeUndefined();
    expect(installment(undefined, 10, SIMPLE, 800)).toBeUndefined();
  });
});

describe('texto das linhas', () => {
  it('escreve o cartao, a parcela do crediario e a taxa como saem na etiqueta', () => {
    const plan = computeInstallmentPlan({ priceInCentavos: 100000, installments: 10, interest: SIMPLE, rateHundredths: 800 });

    expect(describeCardText(10)).toBe('10x sem juros no cartão');
    expect(describeInstallmentText(plan)).toBe('Crediário: 10x de R$ 180,00');
    expect(describeRateText(800)).toBe('Taxa de Juros: 8% a.m.');
    expect(describeRateText(250)).toBe('Taxa de Juros: 2,5% a.m.');
  });

  it('escreve a taxa sem zeros sobrando', () => {
    expect(formatInterestRate(800)).toBe('8%');
    expect(formatInterestRate(250)).toBe('2,5%');
    expect(formatInterestRate(199)).toBe('1,99%');
    expect(formatInterestRate(5)).toBe('0,05%');
    expect(formatInterestRate(2000)).toBe('20%');
  });
});

describe('leitura do que o operador digita', () => {
  it('le a taxa com virgula, ponto ou simbolo de porcentagem', () => {
    expect(parseInterestRate('8')).toBe(800);
    expect(parseInterestRate('2,5')).toBe(250);
    expect(parseInterestRate('1.99')).toBe(199);
    expect(parseInterestRate(' 8% ')).toBe(800);
    expect(parseInterestRate('0')).toBe(0);
    expect(parseInterestRate('20')).toBe(2000);
  });

  it('recusa a taxa fora do contrato com a frase do caso', () => {
    expect(() => parseInterestRate('')).toThrow(INTEREST_RATE_EMPTY_MESSAGE);
    expect(() => parseInterestRate('oito')).toThrow(INTEREST_RATE_EMPTY_MESSAGE);
    expect(() => parseInterestRate('-1')).toThrow(INTEREST_RATE_EMPTY_MESSAGE);
    expect(() => parseInterestRate('1,999')).toThrow(INTEREST_RATE_DECIMALS_MESSAGE);
    expect(() => parseInterestRate('20,01')).toThrow(INTEREST_RATE_RANGE_MESSAGE);
  });

  it('le e recusa a quantidade de parcelas', () => {
    expect(parseInstallmentCount('10')).toBe(10);
    expect(parseInstallmentCount('10x')).toBe(10);
    expect(parseInstallmentCount('2')).toBe(2);
    expect(parseInstallmentCount('24')).toBe(24);
    expect(() => parseInstallmentCount('1')).toThrow(INSTALLMENT_COUNT_MESSAGE);
    expect(() => parseInstallmentCount('25')).toThrow(INSTALLMENT_COUNT_MESSAGE);
    expect(() => parseInstallmentCount('2,5')).toThrow(INSTALLMENT_COUNT_MESSAGE);
    expect(() => parseInstallmentCount('')).toThrow(INSTALLMENT_COUNT_MESSAGE);
  });
});
