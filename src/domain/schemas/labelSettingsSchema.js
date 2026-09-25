import { z } from 'zod';

import {
  INSTALLMENT_COUNT_MAX,
  INSTALLMENT_COUNT_MESSAGE,
  INSTALLMENT_COUNT_MIN,
  INTEREST_MODES,
  INTEREST_MODE_VALUES,
  INTEREST_RATE_DECIMALS_MESSAGE,
  INTEREST_RATE_MAX,
  INTEREST_RATE_RANGE_MESSAGE,
} from '../services/installmentPlan.js';
import { inspectLogoDataUrl, resolveLogo } from '../services/logoImage.js';

/**
 * Configuracao da etiqueta que nao pertence a produto nenhum: o logotipo e o
 * nome da empresa no cabecalho; e, na area comercial, o cartao e o crediario.
 * Nenhum deles entra no simbolo.
 *
 * O logotipo, o nome da empresa e o cartao tem caixa de marcacao: o operador
 * guarda o valor uma vez e decide se ele sai ou nao, sem ter de apaga-lo e
 * digita-lo de novo.
 *
 * O cartao e so a quantidade de parcelas sem juros. Nulo quer dizer que nao ha
 * cartao guardado.
 *
 * O crediario e uma configuracao so, para todos os produtos: a taxa ao mes, o
 * jeito de calcular a parcela, a quantidade de parcelas e o arredondamento da
 * parcela para ,90. A taxa nula quer dizer que nao ha crediario guardado; com
 * ela guardada, a linha da taxa sai sempre. A quantidade so e exigida quando
 * ha calculo — com `Nenhum`, a etiqueta leva so a taxa. A taxa e inteira, em
 * centesimos de ponto percentual (8% = 800), para que o contrato nao carregue
 * ponto flutuante.
 *
 * O logotipo e um endereco de dados em PNG ou JPEG, conferido pelas regras de
 * `logoImage.js`; texto vazio quer dizer que nao ha logotipo guardado.
 *
 * O nome da empresa e de uma linha: quebra de linha nao tem onde aparecer numa
 * zona de uma linha so, e e recusada em vez de sumir sem aviso.
 */

export const COMPANY_NAME_MAX_LENGTH = 40;

const LINE_BREAK = /[\r\n]/;

function singleLineText(label, maxLength) {
  return z
    .string()
    .trim()
    .max(maxLength, `${label} deve ter no máximo ${maxLength} caracteres`)
    .refine((value) => !LINE_BREAK.test(value), `${label} deve caber numa linha só`);
}

const installmentCount = z
  .number({ invalid_type_error: INSTALLMENT_COUNT_MESSAGE })
  .int(INSTALLMENT_COUNT_MESSAGE)
  .min(INSTALLMENT_COUNT_MIN, INSTALLMENT_COUNT_MESSAGE)
  .max(INSTALLMENT_COUNT_MAX, INSTALLMENT_COUNT_MESSAGE)
  .nullable();

const creditRateHundredths = z
  .number({ invalid_type_error: INTEREST_RATE_RANGE_MESSAGE })
  .int(INTEREST_RATE_DECIMALS_MESSAGE)
  .min(0, INTEREST_RATE_RANGE_MESSAGE)
  .max(INTEREST_RATE_MAX, INTEREST_RATE_RANGE_MESSAGE)
  .nullable();

const logoDataUrl = z.string().superRefine((value, context) => {
  if (value === '') {
    return;
  }

  try {
    inspectLogoDataUrl(value);
  } catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: error.message });
  }
});

export const LabelSettingsSchema = z
  .object({
    logoDataUrl,
    showLogo: z.boolean(),
    companyName: singleLineText('Nome da empresa', COMPANY_NAME_MAX_LENGTH),
    showCompanyName: z.boolean(),
    cardInstallments: installmentCount,
    showCardInstallments: z.boolean(),
    creditRateHundredths,
    creditInterest: z.enum(INTEREST_MODE_VALUES),
    creditInstallments: installmentCount,
    creditRoundToNinety: z.boolean(),
  })
  .strict()
  .superRefine((settings, context) => {
    const calculates = settings.creditRateHundredths !== null && settings.creditInterest !== INTEREST_MODES.NONE;

    if (calculates && settings.creditInstallments === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['creditInstallments'],
        message: INSTALLMENT_COUNT_MESSAGE,
      });
    }
  });

export const DEFAULT_LABEL_SETTINGS = Object.freeze({
  logoDataUrl: '',
  showLogo: true,
  companyName: '',
  showCompanyName: true,
  cardInstallments: null,
  showCardInstallments: true,
  creditRateHundredths: null,
  creditInterest: INTEREST_MODES.SIMPLE,
  creditInstallments: null,
  creditRoundToNinety: false,
});

/** Os campos que a configuracao guarda; o que o valor guardado tiver alem disso e descartado na leitura. */
export const LABEL_SETTINGS_FIELDS = Object.freeze(Object.keys(DEFAULT_LABEL_SETTINGS));

/** O cartao vazio, como no padrao: e o que `Apagar` grava. */
export const EMPTY_CARD_SETTINGS = Object.freeze({
  cardInstallments: DEFAULT_LABEL_SETTINGS.cardInstallments,
});

/** O crediario vazio, como no padrao: e o que `Apagar` grava. */
export const EMPTY_CREDIT_SETTINGS = Object.freeze({
  creditRateHundredths: DEFAULT_LABEL_SETTINGS.creditRateHundredths,
  creditInterest: DEFAULT_LABEL_SETTINGS.creditInterest,
  creditInstallments: DEFAULT_LABEL_SETTINGS.creditInstallments,
});

/** Cartao como sai na etiqueta, ou nulo sem cartao guardado ou com a caixa desmarcada. */
export function resolveCardSettings(settings) {
  if (!Number.isInteger(settings?.cardInstallments) || settings?.showCardInstallments !== true) {
    return null;
  }

  return Object.freeze({ installments: settings.cardInstallments });
}

/**
 * Crediario como sai na etiqueta, ou nulo sem taxa guardada. A conta com o
 * preco de cada produto fica com quem escreve a etiqueta.
 */
export function resolveCreditSettings(settings) {
  if (!Number.isInteger(settings?.creditRateHundredths)) {
    return null;
  }

  return Object.freeze({
    rateHundredths: settings.creditRateHundredths,
    interest: settings.creditInterest,
    installments: settings.creditInstallments,
    roundToNinetyCents: settings.creditRoundToNinety === true,
  });
}

/**
 * O que sai na etiqueta: o nome da empresa marcado e preenchido, ou nulo; o
 * logotipo marcado e valido, com formato e medida, ou nulo; e o cartao e o
 * crediario resolvidos, ou nulos. O nome da empresa continua resolvido mesmo
 * com logotipo: onde a etiqueta nao tem lugar para a imagem, e ele que sai.
 */
export function resolveLabelHeader(settings) {
  const companyName =
    settings?.showCompanyName && typeof settings?.companyName === 'string' && settings.companyName.trim() !== ''
      ? settings.companyName.trim()
      : null;

  return {
    companyName,
    logo: settings?.showLogo ? resolveLogo(settings?.logoDataUrl) : null,
    card: resolveCardSettings(settings),
    credit: resolveCreditSettings(settings),
  };
}
