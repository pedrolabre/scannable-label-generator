import { z } from 'zod';

/**
 * Configuracao da etiqueta que nao pertence a produto nenhum: o nome da empresa
 * no cabecalho e a linha de parcelamento da area comercial.
 *
 * Os dois textos sao opcionais e tem uma caixa de marcacao cada: o operador
 * guarda o texto uma vez e decide se ele sai ou nao, sem ter de apaga-lo e
 * digita-lo de novo. Nenhum dos dois entra no simbolo.
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

export const LabelSettingsSchema = z
  .object({
    companyName: singleLineText('Nome da empresa', COMPANY_NAME_MAX_LENGTH),
    showCompanyName: z.boolean(),
    installmentText: singleLineText('Texto de parcelamento', INSTALLMENT_TEXT_MAX_LENGTH),
    showInstallmentText: z.boolean(),
  })
  .strict();

export const DEFAULT_LABEL_SETTINGS = Object.freeze({
  companyName: '',
  showCompanyName: true,
  installmentText: '',
  showInstallmentText: true,
});

/** O que sai na etiqueta: o texto marcado e preenchido, ou nulo. */
export function resolveLabelHeader(settings) {
  const pick = (text, show) => (show && typeof text === 'string' && text.trim() !== '' ? text.trim() : null);

  return {
    companyName: pick(settings?.companyName, settings?.showCompanyName),
    installmentText: pick(settings?.installmentText, settings?.showInstallmentText),
  };
}
