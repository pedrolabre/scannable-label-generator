import { create } from 'zustand';

import {
  isConflictPending,
  nameKeyFor,
  summarizeConflicts,
  withDecision,
} from '../domain/services/importConflict.js';
import {
  applyCorrection,
  candidateForRecord,
  clearCorrection,
} from '../domain/services/importCorrection.js';
import { describeRecord } from '../domain/services/importReport.js';
import {
  createImportReport,
  pushRecordReport,
  rebuildReportIndex,
  replaceRecordReport,
} from '../domain/services/importReportIndex.js';
import { parseImportFiles } from '../domain/services/importService.js';
import { validateImportRecords } from '../domain/services/importValidation.js';
import { writeImportBatch } from '../domain/services/importWriter.js';
import {
  createProduct,
  runProductsTransaction,
  updateProduct,
} from '../storage/productRepository.js';
import { describeStorageError } from '../storage/storageError.js';

import { detectConflicts, entryFor, refreshRecord } from './importBatchUpdates.js';
import { useProductStore } from './useProductStore.js';

/**
 * Estado do lote em leitura, separado do catalogo.
 *
 * O resultado do parsing precisa sobreviver entre a escolha dos arquivos, a
 * revisao do que foi lido e a decisao sobre o que gravar — momentos que nao
 * cabem num unico componente. E o catalogo em `useProductStore` continua sendo
 * so o catalogo: produtos ja gravados, leitura e as tres escritas unitarias.
 * Os dois se encontram no fim do fluxo, quando o lote aprovado passa pelo
 * repositorio de produtos e a listagem e relida.
 *
 * `files` cresce conforme cada arquivo termina, e nao ao fim do lote, para que
 * a tela acompanhe o progresso de uma selecao grande.
 *
 * A conferencia vem logo depois da leitura, na mesma acao: o relatorio comeca
 * por uma contagem, e contagem nao existe sem ter conferido tudo. Durante a
 * varredura so `checkedCount` e publicado; o relatorio inteiro entra no estado
 * uma vez, ao fim, porque publicar a cada fatia redesenharia a tela cem vezes
 * sem ter o que mostrar ainda.
 *
 * A correcao do usuario nao volta ao registro: ela mora em `corrections`, e a
 * reconferencia atinge um registro so — o corrigido —, nunca o lote.
 *
 * ## A deteccao de codigo repetido e um terceiro passo
 *
 * Depois da conferencia, o catalogo e lido uma vez e o lote e agrupado por
 * codigo e por nome. O indice que sobra vive aqui, e nao e recalculado: ele e o
 * que permite que corrigir um nome reavalie apenas os dois grupos envolvidos.
 *
 * A decisao do usuario mora em `conflictDecisions`, mapa proprio indexado por
 * `recordId`, pelo mesmo motivo de `corrections`: a entrada do relatorio e
 * derivada e e reconstruida a cada reconferencia, e o que o usuario respondeu
 * nao pode morar em algo derivado.
 *
 * ## A gravacao nao limpa o lote
 *
 * Ao fim da escrita o lote continua aqui, com o resultado ao lado. E o que
 * permite ler o que aconteceu e retomar a parte que nao entrou. `reset()`
 * continua sendo o unico caminho que descarta o lote.
 */

/**
 * O repositorio entregue a gravacao. Ele e montado aqui, e nao importado pelo
 * servico de gravacao, para que o dominio continue sem conhecer a biblioteca de
 * persistencia — e continue sendo o mesmo e unico caminho de escrita da tabela.
 */
const PRODUCT_REPOSITORY = { createProduct, updateProduct, runProductsTransaction };

function initialState() {
  return {
    isParsing: false,
    isChecking: false,
    isDetecting: false,
    checkedCount: 0,
    detectedCount: 0,
    files: [],
    records: [],
    report: null,
    corrections: {},
    conflictIndex: null,
    conflicts: new Map(),
    conflictDecisions: {},
    conflictSummary: null,
    catalogError: null,
    isWriting: false,
    stopRequested: false,
    writtenCount: 0,
    writeTotal: 0,
    writeResult: null,
    writeError: null,
  };
}

export const useImportStore = create((set, get) => ({
  ...initialState(),

  reset: () => {
    set(initialState());
  },

  parseFiles: async (selectedFiles) => {
    const selected = Array.from(selectedFiles ?? []);

    if (selected.length === 0) {
      return { records: [], files: [] };
    }

    set({ ...initialState(), isParsing: true });

    try {
      const result = await parseImportFiles(selected, {
        onFileSettled: (file) => {
          set({ files: [...get().files, file] });
        },
      });

      set({
        records: result.records,
        files: result.files,
        isParsing: false,
        isChecking: true,
        checkedCount: 0,
      });

      const report = createImportReport();

      await validateImportRecords(result.records, {
        onRecord: (record, validation, index) => {
          pushRecordReport(report, describeRecord(record, validation, index));
        },
        onProgress: (checked) => {
          set({ checkedCount: checked });
        },
      });

      set({ report, isChecking: false, isDetecting: true, detectedCount: 0 });

      await detectConflicts(set, get, result.records, report);

      return result;
    } finally {
      set({ isParsing: false, isChecking: false, isDetecting: false });
    }
  },

  correctRecord: (recordId, field, value) => {
    const { records, corrections, report } = get();
    const entry = report?.entries.get(recordId);

    if (!entry) {
      return;
    }

    const record = records[entry.index];
    const previousKey = nameKeyFor(candidateForRecord(record, corrections));
    const nextCorrections = applyCorrection(corrections, record, field, value);

    set({ corrections: nextCorrections });
    refreshRecord(set, get, record, entry.index, previousKey);
  },

  revertRecord: (recordId) => {
    const { records, corrections, report } = get();
    const entry = report?.entries.get(recordId);

    if (!entry || !corrections[recordId]) {
      return;
    }

    const record = records[entry.index];
    const previousKey = nameKeyFor(candidateForRecord(record, corrections));

    set({ corrections: clearCorrection(corrections, recordId) });
    refreshRecord(set, get, record, entry.index, previousKey);
  },

  /** Resposta do usuario a um conflito de codigo. */
  decideConflict: (recordId, decision) => {
    const { records, report, conflicts, conflictDecisions, corrections } = get();
    const entry = report?.entries.get(recordId);
    const conflict = conflicts.get(recordId);

    if (!entry || !conflict) {
      return;
    }

    const nextDecisions = { ...conflictDecisions, [recordId]: decision };
    const nextConflict = withDecision(conflict, decision);

    conflicts.set(recordId, nextConflict);

    const record = records[entry.index];

    set({
      conflictDecisions: nextDecisions,
      conflictSummary: summarizeConflicts(conflicts),
      report: replaceRecordReport(
        report,
        entryFor(record, entry.index, corrections, nextConflict),
      ),
    });
  },

  /**
   * Mesma resposta para todos os conflitos que ainda esperam decisao, opcionalmente
   * restrita a um tipo de conflito. Muitas entradas trocam de uma vez, entao as
   * contagens e a lista de revisao sao reconstruidas numa passagem so.
   */
  decideAllPending: (decision, kind = null) => {
    const { records, report, conflicts, conflictDecisions, corrections } = get();

    if (!report) {
      return;
    }

    const nextDecisions = { ...conflictDecisions };
    let touched = 0;

    for (const [recordId, conflict] of conflicts) {
      if (!isConflictPending(conflict) || (kind && conflict.code?.kind !== kind)) {
        continue;
      }

      const entry = report.entries.get(recordId);

      if (!entry) {
        continue;
      }

      const nextConflict = withDecision(conflict, decision);

      conflicts.set(recordId, nextConflict);
      nextDecisions[recordId] = decision;
      report.entries.set(
        recordId,
        entryFor(records[entry.index], entry.index, corrections, nextConflict),
      );
      touched += 1;
    }

    if (touched === 0) {
      return;
    }

    set({
      conflictDecisions: nextDecisions,
      conflictSummary: summarizeConflicts(conflicts),
      report: rebuildReportIndex(report),
    });
  },

  stopWriting: () => {
    set({ stopRequested: true });
  },

  /**
   * Grava o que o relatorio libera, em fatias transacionais, e reflete o lote na
   * listagem de produtos.
   *
   * Uma chamada seguinte continua de onde a anterior parou: os registros que ja
   * entraram vao no conjunto que volta no resultado, e por isso nao entram duas
   * vezes. `loadProducts` e chamado uma vez, ao fim, inclusive quando a execucao
   * parou no meio — parte do lote pode ter entrado.
   */
  writeBatch: async () => {
    const { records, report, corrections, writeResult, isWriting } = get();

    if (isWriting || !report) {
      return null;
    }

    const writtenIds = writeResult?.writtenIds ?? new Set();

    set({
      isWriting: true,
      stopRequested: false,
      writtenCount: 0,
      writeTotal: records.length,
      writeError: null,
      writeResult: null,
    });

    try {
      const result = await writeImportBatch(records, {
        report,
        corrections,
        repository: PRODUCT_REPOSITORY,
        writtenIds,
        shouldStop: () => get().stopRequested,
        onProgress: (written) => {
          set({ writtenCount: written });
        },
      });

      await useProductStore
        .getState()
        .loadProducts()
        .catch(() => {});

      set({
        writeResult: result,
        writeError: result.failure ? describeStorageError(result.failure.error) : null,
      });

      return result;
    } catch (error) {
      set({ writeError: describeStorageError(error) });

      return null;
    } finally {
      set({ isWriting: false, stopRequested: false });
    }
  },
}));
