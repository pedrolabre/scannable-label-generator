import { z } from 'zod';

import { positiveIntegerField, slugField, uuidField } from './commonFields.js';

export const PrintJobItemSchema = z
  .object({
    productId: uuidField('Identificador do produto'),
    copies: positiveIntegerField('Quantidade de etiquetas'),
  })
  .strict();

/**
 * Contrato do trabalho de impressao montado na tela.
 *
 * O trabalho e transiente: vive no estado da aplicacao enquanto o operador
 * monta a folha e morre com a pagina. Por isso o contrato nao tem identificador
 * nem data de criacao. Os dois sao campos de identidade e de auditoria, que
 * existem para distinguir uma linha gravada de outra e para ordena-las; um
 * trabalho que nunca e gravado tem exatamente uma instancia e nenhuma historia.
 * Preenche-los a cada montagem faria a validacao depender de relogio e de
 * gerador aleatorio, e o mesmo estado de tela validaria um objeto diferente a
 * cada desenho.
 *
 * As medidas da folha nao entram aqui. `sheetLayoutId` e o ponteiro, e a folha
 * resolvida, com as margens que o operador ajustou, e conferida pelo proprio
 * `SheetLayoutSchema`. Repetir os seis campos em milimetro neste contrato daria
 * a margem duas definicoes e dois conjuntos de mensagem.
 */
export const PrintJobSchema = z
  .object({
    labelLayoutId: slugField('Identificador do modelo de etiqueta'),
    sheetLayoutId: slugField('Identificador do modelo de folha'),
    items: z.array(PrintJobItemSchema).min(1, 'Selecione ao menos um produto para imprimir'),
  })
  .strict()
  .superRefine((printJob, ctx) => {
    const seen = new Set();

    printJob.items.forEach((item, index) => {
      if (seen.has(item.productId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'productId'],
          message: 'Produto repetido na seleção: some as quantidades em um único item',
        });
        return;
      }

      seen.add(item.productId);
    });
  });
