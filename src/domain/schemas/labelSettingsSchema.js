import { z } from 'zod';

import { inspectLogoDataUrl, resolveLogo } from '../services/logoImage.js';

/**
 * Configuracao da etiqueta que nao pertence a produto nenhum: o logotipo e o
 * nome da empresa no cabecalho, e a linha de parcelamento da area comercial.
 *
 * Os tres sao opcionais e tem uma caixa de marcacao cada: o operador guarda o
 * valor uma vez e decide se ele sai ou nao, sem ter de apaga-lo e carrega-lo
 * de novo. Nenhum deles entra no simbolo.
 *
 * O logotipo e um endereco de dados em PNG ou JPEG, conferido pelas regras de
 * `logoImage.js`; texto vazio quer dizer que nao ha logotipo guardado.
 *
 * Os textos sao de uma linha: quebra de linha nao tem onde aparecer numa zona
 * de uma linha so, e e recusada em vez de sumir sem aviso.
 */

export const COMPANY_NAME_MAX_LENGTH = 40;
export const INSTALLMENT_TEXT_MAX_LENGTH = 60;

const LINE_BREAK = /[\r\n]/;

function singleLineText(label, maxLength) {
  return z
    .string()
    .trim()
    .max(maxLength, `${label} deve ter no máximo ${maxLength} caracteres`)
    .refine((value) => !LINE_BREAK.test(value), `${label} deve caber numa linha só`);
}

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
    installmentText: singleLineText('Texto de parcelamento', INSTALLMENT_TEXT_MAX_LENGTH),
    showInstallmentText: z.boolean(),
  })
  .strict();

export const DEFAULT_LABEL_SETTINGS = Object.freeze({
  logoDataUrl: '',
  showLogo: true,
  companyName: '',
  showCompanyName: true,
  installmentText: '',
  showInstallmentText: true,
});

/**
 * O que sai na etiqueta: o texto marcado e preenchido, ou nulo; e o logotipo
 * marcado e valido, com formato e medida, ou nulo. O nome da empresa continua
 * resolvido mesmo com logotipo: onde a etiqueta nao tem lugar para a imagem, e
 * ele que sai.
 */
export function resolveLabelHeader(settings) {
  const pick = (text, show) => (show && typeof text === 'string' && text.trim() !== '' ? text.trim() : null);

  return {
    companyName: pick(settings?.companyName, settings?.showCompanyName),
    installmentText: pick(settings?.installmentText, settings?.showInstallmentText),
    logo: settings?.showLogo ? resolveLogo(settings?.logoDataUrl) : null,
  };
}
