import { z } from 'zod';

import {
  millimetersField,
  nonNegativeMillimetersField,
  shortTextField,
  slugField,
} from './commonFields.js';

export const LABEL_NAME_MAX_LENGTH = 60;

export const LabelLayoutSchema = z
  .object({
    id: slugField('Identificador do modelo de etiqueta'),
    name: shortTextField('Nome do modelo de etiqueta', LABEL_NAME_MAX_LENGTH),
    widthMm: millimetersField('Largura da etiqueta'),
    heightMm: millimetersField('Altura da etiqueta'),
    paddingMm: nonNegativeMillimetersField('Margem interna da etiqueta'),
    symbolSizeMm: millimetersField('Lado do simbolo 2D'),
    quietZoneMm: millimetersField('Zona de silencio do simbolo 2D'),
  })
  .strict()
  .superRefine((layout, ctx) => {
    const usableWidth = layout.widthMm - layout.paddingMm * 2;
    const usableHeight = layout.heightMm - layout.paddingMm * 2;
    const symbolFootprint = layout.symbolSizeMm + layout.quietZoneMm * 2;

    if (usableWidth <= 0 || usableHeight <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paddingMm'],
        message: 'Margem interna nao deixa area util na etiqueta',
      });
      return;
    }

    if (symbolFootprint > usableWidth || symbolFootprint > usableHeight) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['symbolSizeMm'],
        message: 'Simbolo 2D e zona de silencio nao cabem na area util da etiqueta',
      });
    }
  });
