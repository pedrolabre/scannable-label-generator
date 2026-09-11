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
      .min(1, 'Codigo do sistema obrigatorio')
      .regex(/^[0-9A-Za-z-]+$/, 'Codigo do sistema aceita apenas letras, numeros e hifen'),
    displayName: shortTextField('Nome da etiqueta', DISPLAY_NAME_MAX_LENGTH),
    description: z
      .string()
      .trim()
      .max(DESCRIPTION_MAX_LENGTH, `Descricao deve ter no maximo ${DESCRIPTION_MAX_LENGTH} caracteres`)
      .optional(),
    priceInCentavos: z
      .number({ invalid_type_error: 'Preco deve ser um valor em centavos' })
      .int('Preco deve ser um valor inteiro em centavos')
      .min(0, 'Preco invalido'),
    ean: z
      .string()
      .trim()
      .regex(/^(\d{8}|\d{12,14})$/, 'Codigo de barras deve ter 8, 12, 13 ou 14 digitos')
      .optional(),
    category: z.string().trim().max(60, 'Categoria deve ter no maximo 60 caracteres').optional(),
    notes: z.string().trim().max(500, 'Observacoes devem ter no maximo 500 caracteres').optional(),
    createdAt: isoDateTimeField('Data de criacao'),
    updatedAt: isoDateTimeField('Data de atualizacao'),
  })
  .strict();
