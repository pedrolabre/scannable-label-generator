import { z } from 'zod';

import { isoDateTimeField, shortTextField, uuidField } from './commonFields.js';

export const DISPLAY_NAME_MAX_LENGTH = 60;
export const DESCRIPTION_MAX_LENGTH = 120;
export const NCM_LENGTH = 8;

/**
 * O nome da etiqueta vai inteiro para dentro do simbolo, num texto em que a
 * barra vertical separa os campos. Barra ou quebra de linha no nome mudaria a
 * posicao de todos os campos seguintes, entao o contrato recusa as duas aqui,
 * antes de o produto ser gravado, e nao na hora de imprimir.
 */
const DISPLAY_NAME_UNSAFE_CHARACTERS = /[|\u0000-\u001F\u007F]/;

export const ProductSchema = z
  .object({
    id: uuidField('Identificador do produto'),
    systemCode: z
      .string()
      .trim()
      .min(1, 'Código do sistema obrigatório')
      .regex(/^[0-9A-Za-z-]+$/, 'Código do sistema aceita apenas letras, números e hífen'),
    displayName: shortTextField('Nome da etiqueta', DISPLAY_NAME_MAX_LENGTH).refine(
      (value) => !DISPLAY_NAME_UNSAFE_CHARACTERS.test(value),
      'Nome da etiqueta não pode ter barra vertical (|) nem quebra de linha',
    ),
    description: z
      .string()
      .trim()
      .max(DESCRIPTION_MAX_LENGTH, `Descrição deve ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres`)
      .optional(),
    priceInCentavos: z
      // As duas mensagens sao a mesma frase de proposito: quem le a etiqueta em
      // branco nao distingue "o preco veio como texto" de "o preco nao veio", e
      // as duas se resolvem digitando o valor. Sem a primeira, o campo ausente
      // cairia na mensagem padrao da biblioteca, em ingles.
      .number({
        required_error: 'Informe um preço válido. Ex.: 12,50',
        invalid_type_error: 'Informe um preço válido. Ex.: 12,50',
      })
      .int('Informe um preço válido. Ex.: 12,50')
      .min(0, 'Informe um preço válido. Ex.: 12,50'),
    ean: z
      .string()
      .trim()
      .regex(/^(\d{8}|\d{12,14})$/, 'Código de barras deve ter 8, 12, 13 ou 14 dígitos')
      .optional(),
    ncm: z
      .string()
      .trim()
      .regex(/^\d{8}$/, `NCM deve ter ${NCM_LENGTH} dígitos, sem ponto`)
      .optional(),
    category: z.string().trim().max(60, 'Categoria deve ter no máximo 60 caracteres').optional(),
    notes: z.string().trim().max(500, 'Observações devem ter no máximo 500 caracteres').optional(),
    createdAt: isoDateTimeField('Data de criação'),
    updatedAt: isoDateTimeField('Data de atualização'),
  })
  .strict();
