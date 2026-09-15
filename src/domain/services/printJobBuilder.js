/**
 * Montagem e conferencia do trabalho de impressao.
 *
 * Duas montagens, uma por contrato. A folha sai do catalogo com as quatro
 * margens e os dois espacamentos substituidos pelo que o operador ajustou, e
 * passa pelo `SheetLayoutSchema`; o trabalho aponta para os dois modelos por
 * identificador e passa pelo `PrintJobSchema`. Identificador e nome da folha
 * nunca sao editaveis, entao saem sempre validos do proprio catalogo e so os
 * seis numeros variam: e por isso que nenhum dos dois contratos precisou mudar
 * de forma para acomodar ajuste em tempo de execucao.
 *
 * Funcoes puras, sem DOM, sem React e sem armazenamento. Elas nao sabem onde o
 * erro e exibido: devolvem a mensagem por campo e a mensagem geral, e quem
 * desenha decide onde cada uma aparece.
 */

import { PrintJobSchema } from '../schemas/printJobSchema.js';
import { SheetLayoutSchema } from '../schemas/sheetLayoutSchema.js';

import { findLabelLayout } from './labelLayoutCatalog.js';
import { findSheetLayout } from './sheetLayoutCatalog.js';

/** Os unicos campos da folha que o operador alcanca. */
export const ADJUSTABLE_SHEET_FIELDS = Object.freeze([
  'marginTopMm',
  'marginRightMm',
  'marginBottomMm',
  'marginLeftMm',
  'columnGapMm',
  'rowGapMm',
]);

const EMPTY_ERRORS = Object.freeze({ fields: Object.freeze({}), general: Object.freeze([]) });

/**
 * Traduz a recusa do contrato para duas formas: a mensagem presa a um campo,
 * enderecada pelo caminho com pontos (`items.0.copies`), e a mensagem que nao
 * pertence a campo nenhum.
 *
 * So a primeira mensagem de cada campo e guardada: o campo tem um lugar so para
 * exibir, e empilhar recusas ali trocaria a primeira causa por ruido.
 */
function describeIssues(error) {
  const fields = {};
  const general = [];

  error.issues.forEach((issue) => {
    if (issue.path.length === 0) {
      general.push(issue.message);
      return;
    }

    const key = issue.path.join('.');

    if (!(key in fields)) {
      fields[key] = issue.message;
    }
  });

  return { fields, general };
}

function generalOnly(message) {
  return { fields: {}, general: [message] };
}

/**
 * Monta a folha a partir do modelo escolhido e dos ajustes do operador. Os
 * ajustes chegam ja convertidos em numero; campo ausente mantem o valor do
 * modelo.
 */
export function buildSheetLayout(sheetLayoutId, adjustments = {}) {
  const base = findSheetLayout(sheetLayoutId);

  if (!base) {
    return { sheet: null, errors: generalOnly('Escolha um modelo de folha para a impressão.') };
  }

  const candidate = { ...base };

  ADJUSTABLE_SHEET_FIELDS.forEach((field) => {
    const adjusted = adjustments[field];

    if (adjusted !== undefined && adjusted !== null) {
      candidate[field] = adjusted;
    }
  });

  const parsed = SheetLayoutSchema.safeParse(candidate);

  if (!parsed.success) {
    return { sheet: null, errors: describeIssues(parsed.error) };
  }

  return { sheet: Object.freeze(parsed.data), errors: EMPTY_ERRORS };
}

/**
 * Monta o trabalho de impressao. Os itens chegam com a quantidade ja convertida
 * em numero; item sem quantidade valida nao deve chegar aqui, e se chegar e o
 * contrato quem recusa.
 */
export function buildPrintJob({ labelLayoutId, sheetLayoutId, items }) {
  if (!findLabelLayout(labelLayoutId)) {
    return { job: null, errors: generalOnly('Escolha um modelo de etiqueta para a impressão.') };
  }

  if (!findSheetLayout(sheetLayoutId)) {
    return { job: null, errors: generalOnly('Escolha um modelo de folha para a impressão.') };
  }

  const parsed = PrintJobSchema.safeParse({ labelLayoutId, sheetLayoutId, items });

  if (!parsed.success) {
    return { job: null, errors: describeIssues(parsed.error) };
  }

  return { job: Object.freeze(parsed.data), errors: EMPTY_ERRORS };
}

/** Soma de etiquetas do trabalho. Contagem, e nao diagramacao de folha. */
export function countCopies(items) {
  if (!Array.isArray(items)) {
    return 0;
  }

  return items.reduce((total, item) => total + (Number.isFinite(item?.copies) ? item.copies : 0), 0);
}
