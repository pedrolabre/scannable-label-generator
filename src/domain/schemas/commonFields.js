import { z } from 'zod';

export const uuidField = (label) => z.string().uuid(`${label} invalido`);

export const slugField = (label) =>
  z
    .string()
    .min(1, `${label} obrigatorio`)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${label} aceita apenas letras minusculas, numeros e hifen`);

export const isoDateTimeField = (label) =>
  z.string().datetime(`${label} deve estar no formato ISO 8601`);

export const shortTextField = (label, maxLength) =>
  z
    .string()
    .trim()
    .min(1, `${label} obrigatorio`)
    .max(maxLength, `${label} deve ter no maximo ${maxLength} caracteres`);

export const millimetersField = (label) =>
  z
    .number({ invalid_type_error: `${label} deve ser um numero em milimetros` })
    .finite(`${label} deve ser um numero valido`)
    .positive(`${label} deve ser maior que zero`);

export const nonNegativeMillimetersField = (label) =>
  z
    .number({ invalid_type_error: `${label} deve ser um numero em milimetros` })
    .finite(`${label} deve ser um numero valido`)
    .min(0, `${label} nao pode ser negativo`);

export const positiveIntegerField = (label) =>
  z
    .number({ invalid_type_error: `${label} deve ser um numero inteiro` })
    .int(`${label} deve ser um numero inteiro`)
    .positive(`${label} deve ser maior que zero`);
