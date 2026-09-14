import { z } from 'zod';

import {
  millimetersField,
  nonNegativeMillimetersField,
  shortTextField,
  slugField,
} from './commonFields.js';

export const LABEL_NAME_MAX_LENGTH = 60;

/**
 * Contrato de um modelo de etiqueta, em milimetros reais.
 *
 * `symbolSizeMm` e o lado da caixa inteira do simbolo 2D, zona de silencio
 * incluida: o desenho que o gerador devolve ja traz os quatro modulos brancos
 * de cada lado dentro da propria caixa. Nao ha campo separado para a zona de
 * silencio porque reserva-la de novo aqui contaria o mesmo espaco duas vezes.
 *
 * `paddingMm` e a margem de borda da etiqueta, a folga para o corte e para o
 * desregistro da impressora. Ela nao tem relacao com a zona de silencio.
 */
export const LabelLayoutSchema = z
  .object({
    id: slugField('Identificador do modelo de etiqueta'),
    name: shortTextField('Nome do modelo de etiqueta', LABEL_NAME_MAX_LENGTH),
    widthMm: millimetersField('Largura da etiqueta'),
    heightMm: millimetersField('Altura da etiqueta'),
    paddingMm: nonNegativeMillimetersField('Margem interna da etiqueta'),
    symbolSizeMm: millimetersField('Lado do simbolo 2D'),
  })
  .strict()
  .superRefine((layout, ctx) => {
    const usableWidth = layout.widthMm - layout.paddingMm * 2;
    const usableHeight = layout.heightMm - layout.paddingMm * 2;

    if (usableWidth <= 0 || usableHeight <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paddingMm'],
        message: 'Margem interna nao deixa area util na etiqueta',
      });
      return;
    }

    // Checagem barata e local: o simbolo sozinho ja nao cabe. A viabilidade
    // completa do modelo, que soma afastamento, linha de nome e coluna de
    // texto, e do calculo de zonas, que e quem conhece essas medidas.
    if (layout.symbolSizeMm > usableWidth || layout.symbolSizeMm > usableHeight) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['symbolSizeMm'],
        message: 'Simbolo 2D nao cabe na area util da etiqueta',
      });
    }
  });
