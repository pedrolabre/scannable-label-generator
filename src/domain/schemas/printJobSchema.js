import { z } from 'zod';

import { isoDateTimeField, positiveIntegerField, slugField, uuidField } from './commonFields.js';

export const PrintJobItemSchema = z
  .object({
    productId: uuidField('Identificador do produto'),
    copies: positiveIntegerField('Quantidade de etiquetas'),
  })
  .strict();

export const PrintJobSchema = z
  .object({
    id: uuidField('Identificador do trabalho de impressao'),
    labelLayoutId: slugField('Identificador do modelo de etiqueta'),
    sheetLayoutId: slugField('Identificador do modelo de folha'),
    items: z.array(PrintJobItemSchema).min(1, 'Selecione ao menos um produto para imprimir'),
    createdAt: isoDateTimeField('Data de criacao'),
  })
  .strict()
  .superRefine((printJob, ctx) => {
    const seen = new Set();

    printJob.items.forEach((item, index) => {
      if (seen.has(item.productId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'productId'],
          message: 'Produto repetido na selecao: some as quantidades em um unico item',
        });
        return;
      }

      seen.add(item.productId);
    });
  });
