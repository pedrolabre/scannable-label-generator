import { z } from 'zod';

export const uuidField = (label) => z.string().uuid(`${label} inválido`);

export const slugField = (label) =>
  z
    .string()
    .min(1, `${label} obrigatório`)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${label} aceita apenas letras minúsculas, números e hífen`);

export const isoDateTimeField = (label) =>
  z.string().datetime(`${label} deve estar no formato ISO 8601`);

export const shortTextField = (label, maxLength) =>
  z
    .string()
    .trim()
    .min(1, `${label} obrigatório`)
    .max(maxLength, `${label} deve ter no máximo ${maxLength} caracteres`);

export const millimetersField = (label) =>
  z
    .number({ invalid_type_error: `${label} deve ser um número em milímetros` })
    .finite(`${label} deve ser um número válido`)
    .positive(`${label} deve ser maior que zero`);

export const nonNegativeMillimetersField = (label) =>
  z
    .number({ invalid_type_error: `${label} deve ser um número em milímetros` })
    .finite(`${label} deve ser um número válido`)
    .min(0, `${label} não pode ser negativo`);

export const positiveIntegerField = (label) =>
  z
    .number({ invalid_type_error: `${label} deve ser um número inteiro` })
    .int(`${label} deve ser um número inteiro`)
    .positive(`${label} deve ser maior que zero`);
