import { create } from 'zustand';

import { IMPORT_FORMAT_ODS } from '../domain/services/importRecord.js';
import { parseImportFiles } from '../domain/services/importService.js';
import { buildReferenceEntries } from '../domain/services/referenceEntries.js';
import {
  clearReferenceEntries,
  getReferenceStats,
  replaceReferenceEntries,
} from '../storage/referenceRepository.js';
import { describeStorageError, describeStorageReadError } from '../storage/storageError.js';

import { createReferenceCompletionSlice } from './referenceCompletionSlice.js';

/**
 * Estado da tela da base de referencia, separado do Completar dados e da
 * importacao.
 *
 * A tela faz tres coisas com a base: mostra o que ela guarda, troca a base
 * inteira por uma planilha nova e apaga a base. Nenhuma das tres toca o
 * catalogo. A quarta, completar o catalogo pela base, mora em
 * `referenceCompletionSlice.js` e grava produtos, com resumo antes.
 *
 * As estatisticas sao lidas ao abrir a tela e de novo depois de cada carga ou
 * limpeza, porque e a base gravada que elas descrevem, e nao o que a tela
 * acabou de mandar gravar.
 *
 * A carga segue a pausa do Completar dados: ler a planilha e mostrar o resumo,
 * esperar a confirmacao e so entao trocar a base. Ate a confirmacao nada foi
 * gravado. So a planilha `.ods` alimenta a base, como no Completar dados.
 */

export const REFERENCE_FILE_EXTENSIONS = Object.freeze(['.ods']);

export const SHEET_STATUS = Object.freeze({
  IDLE: 'idle',
  READING: 'reading',
  READY: 'ready',
  WRITING: 'writing',
  DONE: 'done',
});

const READ_FAILURE_MESSAGE = 'Não foi possível ler a planilha escolhida. Tente de novo.';

function initialSheetState() {
  return {
    sheetStatus: SHEET_STATUS.IDLE,
    sheetFiles: [],
    sheetReference: null,
    sheetResult: null,
    sheetError: null,
  };
}

export const useReferenceStore = create((set, get) => ({
  stats: null,
  isLoadingStats: false,
  statsError: null,
  ...initialSheetState(),

  loadStats: async () => {
    set({ isLoadingStats: true, statsError: null });

    try {
      set({ stats: await getReferenceStats(), isLoadingStats: false });
    } catch (error) {
      set({ stats: null, isLoadingStats: false, statsError: describeStorageReadError(error) });
    }
  },

  resetSheet: () => {
    set(initialSheetState());
  },

  readSheet: async (selectedFiles) => {
    const selected = Array.from(selectedFiles ?? []);

    if (selected.length === 0 || get().sheetStatus === SHEET_STATUS.READING) {
      return;
    }

    set({ ...initialSheetState(), sheetStatus: SHEET_STATUS.READING });

    try {
      const parsed = await parseImportFiles(selected, {
        acceptedExtensions: REFERENCE_FILE_EXTENSIONS,
        onFileSettled: (file) => {
          set({ sheetFiles: [...get().sheetFiles, file] });
        },
      });
      const sheetRecords = parsed.records.filter((record) => record.source?.format === IMPORT_FORMAT_ODS);

      set({
        sheetStatus: sheetRecords.length > 0 ? SHEET_STATUS.READY : SHEET_STATUS.IDLE,
        sheetFiles: parsed.files,
        sheetReference: sheetRecords.length > 0 ? buildReferenceEntries(sheetRecords) : null,
      });
    } catch {
      set({ sheetStatus: SHEET_STATUS.IDLE, sheetError: READ_FAILURE_MESSAGE });
    }
  },

  /**
   * Troca a base inteira pelas linhas da planilha lida. A falha deixa a base
   * como estava — a troca e uma transacao so — e o resumo na tela, com o motivo
   * e o botao servindo de nova tentativa.
   */
  confirmSheet: async () => {
    const { sheetStatus, sheetReference } = get();

    if (sheetStatus !== SHEET_STATUS.READY || !sheetReference || sheetReference.entries.length === 0) {
      return;
    }

    set({ sheetStatus: SHEET_STATUS.WRITING, sheetError: null });

    try {
      const entryCount = await replaceReferenceEntries(sheetReference.entries);

      set({ sheetStatus: SHEET_STATUS.DONE, sheetResult: { entryCount } });
    } catch (error) {
      set({ sheetStatus: SHEET_STATUS.READY, sheetError: describeStorageError(error) });
      return;
    }

    await get().loadStats();
  },

  /**
   * Apaga a base inteira. A falha sobe para o dialogo de confirmacao, que a
   * mostra e deixa tentar de novo; as estatisticas so sao relidas depois de a
   * base ter sido apagada.
   */
  clearBase: async () => {
    await clearReferenceEntries();
    await get().loadStats();
  },

  ...createReferenceCompletionSlice(set, get),
}));
