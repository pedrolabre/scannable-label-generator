import { z } from 'zod';

import {
  millimetersField,
  nonNegativeMillimetersField,
  shortTextField,
  slugField,
} from './commonFields.js';

export const SHEET_NAME_MAX_LENGTH = 60;

export const SheetLayoutSchema = z
  .object({
    id: slugField('Identificador do modelo de folha'),
    name: shortTextField('Nome do modelo de folha', SHEET_NAME_MAX_LENGTH),
    widthMm: millimetersField('Largura da folha'),
    heightMm: millimetersField('Altura da folha'),
    marginTopMm: nonNegativeMillimetersField('Margem superior'),
    marginRightMm: nonNegativeMillimetersField('Margem direita'),
    marginBottomMm: nonNegativeMillimetersField('Margem inferior'),
    marginLeftMm: nonNegativeMillimetersField('Margem esquerda'),
    columnGapMm: nonNegativeMillimetersField('Espacamento entre colunas'),
    rowGapMm: nonNegativeMillimetersField('Espacamento entre linhas'),
  })
  .strict()
  .superRefine((sheet, ctx) => {
    if (sheet.marginLeftMm + sheet.marginRightMm >= sheet.widthMm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['marginLeftMm'],
        message: 'Margens laterais ocupam toda a largura da folha',
      });
    }

    if (sheet.marginTopMm + sheet.marginBottomMm >= sheet.heightMm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['marginTopMm'],
        message: 'Margens verticais ocupam toda a altura da folha',
      });
    }
  });
