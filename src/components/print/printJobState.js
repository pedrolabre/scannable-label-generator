import { useMemo } from 'react';

import { findLabelLayout } from '../../domain/services/labelLayoutCatalog.js';
import {
  buildPrintJob,
  buildSheetLayout,
  countCopies,
} from '../../domain/services/printJobBuilder.js';
import { computeSheetGrid, describeEmptyGrid } from '../../domain/services/sheetGrid.js';
import { findSheetLayout } from '../../domain/services/sheetLayoutCatalog.js';
import { paginateLabels } from '../../domain/services/sheetPagination.js';
import { describeProductSymbolSupport } from '../../domain/services/symbolContent.js';
import { usePrintJobStore } from '../../store/usePrintJobStore.js';

import {
  SHEET_FIELDS,
  describeCompactGain,
  parseCopies,
  parseMillimeters,
} from './printInputs.js';
import { resolvePrintItems } from './printSelection.js';

/**
 * Leitura completa do trabalho de impressao a partir do que o operador marcou e
 * digitou.
 *
 * Tres lugares da tela precisam da mesma resposta: a coluna da esquerda, que
 * configura; o dialogo da folha, que desenha; e a linha de estado, que conta as
 * folhas. Calcular em cada um deles abriria tres chances de divergir, e por isso
 * a conta mora aqui e e feita uma vez por quem monta a tela.
 *
 * Ela nao vai para o store. O store guarda o que o operador escreveu —
 * identificador e texto —, e o que sai daqui e consequencia disso. Um valor
 * derivado guardado ao lado da origem pode ficar para tras dela; recalculado,
 * nao pode.
 *
 * A funcao e pura e nao conhece React. O gancho abaixo so le o store e guarda o
 * resultado enquanto nada muda.
 */

export function describePrintJobState({
  products = [],
  selection = [],
  labelLayoutId,
  sheetLayoutId,
  sheetAdjustments = {},
}) {
  // A ultima copia e o exemplar de texto mais longo: se ela tem simbolo, a
  // tiragem inteira do produto tem.
  const items = resolvePrintItems(products, selection).map((entry) => {
    const parsed = parseCopies(entry.copies);
    const lastCopy = parsed.error === null ? parsed.value : 1;

    return {
      ...entry,
      parsed,
      hasSymbol: describeProductSymbolSupport(entry.product, lastCopy).supported,
    };
  });

  // Os seis numeros da folha sao lidos do texto antes de chegarem ao contrato.
  // Campo que nao le mantem o valor do modelo na montagem: o erro dele ja
  // bloqueia o trabalho, e recusar a folha inteira por um campo em edicao
  // esconderia as outras recusas.
  const fieldErrors = {};
  const adjustments = {};

  SHEET_FIELDS.forEach((field) => {
    const { value, error } = parseMillimeters(sheetAdjustments[field.key], field);

    if (error) {
      fieldErrors[field.key] = error;
      return;
    }

    adjustments[field.key] = value;
  });

  const { sheet, errors: sheetErrors } = buildSheetLayout(sheetLayoutId, adjustments);

  Object.entries(sheetErrors.fields).forEach(([key, message]) => {
    if (!(key in fieldErrors)) {
      fieldErrors[key] = message;
    }
  });

  const jobItems = items
    .filter((entry) => entry.parsed.error === null)
    .map((entry) => ({ productId: entry.product.id, copies: entry.parsed.value }));

  const { job, errors: jobErrors } = buildPrintJob({ labelLayoutId, sheetLayoutId, items: jobItems });

  const firstSheetError =
    SHEET_FIELDS.map((field) => fieldErrors[field.key]).find(Boolean) ?? sheetErrors.general[0];
  const firstCopiesError = items.map((entry) => entry.parsed.error).find(Boolean);
  const firstJobError = Object.values(jobErrors.fields)[0] ?? jobErrors.general[0] ?? null;

  const configMessage = firstSheetError ?? firstCopiesError ?? firstJobError ?? null;
  const canDraw = Boolean(sheet) && Boolean(job) && !configMessage;

  const labelLayout = findLabelLayout(labelLayoutId) ?? null;
  const grid = canDraw && labelLayout ? computeSheetGrid(sheet, labelLayout) : null;
  const capacityMessage = grid && grid.perSheet === 0 ? describeEmptyGrid(grid, labelLayout) : null;

  const blockingMessage = configMessage ?? capacityMessage;
  const isReady = canDraw && Boolean(grid) && !blockingMessage;

  // A contagem de folhas so existe para um trabalho que desenha. Um trabalho
  // recusado nao ocupa folha nenhuma, e dizer zero e mais honesto do que repetir
  // a ultima conta que valeu.
  const totalSheets = isReady ? paginateLabels(job.items, grid.perSheet).totalSheets : 0;

  // O atalho que aproveita a folha so aparece quando rende mais etiquetas do
  // que as margens do modelo. A conta nao depende da selecao nem do que esta
  // digitado, so do par de modelos.
  const canCompact = describeCompactGain(findSheetLayout(sheetLayoutId), labelLayout).gains;

  return {
    items,
    fieldErrors,
    sheet,
    job,
    jobItems,
    labelLayout,
    grid,
    blockingMessage,
    isReady,
    missingSymbolCount: items.filter((entry) => !entry.hasSymbol).length,
    totalCopies: countCopies(jobItems),
    totalSheets,
    canCompact,
  };
}

export function usePrintJobState(products) {
  const selection = usePrintJobStore((state) => state.selection);
  const labelLayoutId = usePrintJobStore((state) => state.labelLayoutId);
  const sheetLayoutId = usePrintJobStore((state) => state.sheetLayoutId);
  const sheetAdjustments = usePrintJobStore((state) => state.sheetAdjustments);

  return useMemo(
    () =>
      describePrintJobState({
        products,
        selection,
        labelLayoutId,
        sheetLayoutId,
        sheetAdjustments,
      }),
    [products, selection, labelLayoutId, sheetLayoutId, sheetAdjustments],
  );
}
