import { z } from 'zod';

import { isoDateTimeField } from './commonFields.js';
import { ProductSchema } from './productSchema.js';

/**
 * Contrato de uma linha da base de referencia.
 *
 * O codigo, o NCM e o codigo de barras sao conferidos pelas mesmas regras do
 * produto, reaproveitadas do `ProductSchema`, e nao copiadas: um valor que o
 * produto recusaria nunca entra na base, e o que sai dela para completar um
 * produto passa no contrato dele sem conversao.
 *
 * `comparableCode` e a chave da tabela. Ele vem pronto de quem monta a linha,
 * que e quem sabe como o codigo e comparado; aqui so se confere que ele existe.
 *
 * Linha sem NCM e sem codigo de barras nao tem o que oferecer, e e recusada.
 */
export const ReferenceEntrySchema = z
  .object({
    comparableCode: z.string().trim().min(1, 'Código comparável obrigatório'),
    systemCode: ProductSchema.shape.systemCode,
    ncm: ProductSchema.shape.ncm,
    ean: ProductSchema.shape.ean,
    loadedAt: isoDateTimeField('Data da carga'),
  })
  .strict()
  .refine((entry) => entry.ncm !== undefined || entry.ean !== undefined, {
    message: 'A linha precisa ter NCM ou código de barras',
    path: ['ncm'],
  });
