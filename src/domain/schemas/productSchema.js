import { z } from 'zod';

import { isoDateTimeField, shortTextField, uuidField } from './commonFields.js';

export const DISPLAY_NAME_MAX_LENGTH = 60;
export const DESCRIPTION_MAX_LENGTH = 120;

export const ProductSchema = z
  .object({
    id: uuidField('Identificador do produto'),
    systemCode: z
      .string()
      .trim()
      .min(1, 'Código do sistema obrigatório')
      .regex(/^[0-9A-Za-z-]+$/, 'Código do sistema aceita apenas letras, números e hífen'),
    displayName: shortTextField('Nome da etiqueta', DISPLAY_NAME_MAX_LENGTH),
    description: z
      .string()
      .trim()
      .max(DESCRIPTION_MAX_LENGTH, `Descrição deve ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres`)
      .optional(),
    priceInCentavos: z
      .number({ invalid_type_error: 'Informe um preço válido. Ex.: 12,50' })
      .int('Informe um preço válido. Ex.: 12,50')
      .min(0, 'Informe um preço válido. Ex.: 12,50'),
    ean: z
      .string()
      .trim()
      .regex(/^(\d{8}|\d{12,14})$/, 'Código de barras deve ter 8, 12, 13 ou 14 dígitos')
      .optional(),
    category: z.string().trim().max(60, 'Categoria deve ter no máximo 60 caracteres').optional(),
    notes: z.string().trim().max(500, 'Observações devem ter no máximo 500 caracteres').optional(),
    createdAt: isoDateTimeField('Data de criação'),
    updatedAt: isoDateTimeField('Data de atualização'),
  })
  .strict();
