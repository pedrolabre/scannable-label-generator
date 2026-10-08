import { create } from 'zustand';

import { parseImportFiles } from '../domain/services/importService.js';
import { buildReferenceEntries, selectReferenceRecords } from '../domain/services/referenceEntries.js';
import {
  clearReferenceEntries,
  getReferenceStats,
  mergeReferenceEntries,
  previewReferenceLoad,
  replaceReferenceBase,
} from '../storage/referenceRepository.js';
import { describeStorageError, describeStorageReadError } from '../storage/storageError.js';

import { createReferenceCompletionSlice } from './referenceCompletionSlice.js';

/**
 * Estado da tela da base de referencia, separado do Completar dados e da
 * importacao.
 *
 * A tela faz tres coisas com a base: mostra o que ela guarda, carrega um
 * arquivo nela e apaga a base. Nenhuma das tres toca o catalogo. A quarta,
 * completar o catalogo pela base, mora em
 * `referenceCompletionSlice.js` e grava produtos, com resumo antes.
 *
 * As estatisticas sao lidas ao abrir a tela e de novo depois de cada carga ou
 * limpeza, porque e a base gravada que elas descrevem, e nao o que a tela
 * acabou de mandar gravar.
 *
 * A carga segue a pausa do Completar dados: ler o arquivo e mostrar o resumo,
 * esperar a confirmacao e so entao atualizar ou trocar a base.
 */

export const REFERENCE_FILE_EXTENSIONS = Object.freeze(['.ods', '.csv', '.json', '.txt']);

export const SHEET_LOAD_MODE = Object.freeze({
  MERGE: 'merge',
  REPLACE: 'replace',
});

export const SHEET_STATUS = Object.freeze({
  IDLE: 'idle',
  READING: 'reading',
  READY: 'ready',
  WRITING: 'writing',
  DONE: 'done',
});

const READ_FAILURE_MESSAGE = 'Não foi possível ler o arquivo escolhido. Tente de novo.';

const NOTHING_TO_LOAD_MESSAGE =
  'Nenhum arquivo escolhido traz coluna de NCM ou de código de barras; a base fica como está.';

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
      const sheetRecords = selectReferenceRecords(parsed.records);

      if (sheetRecords.length === 0) {
        const anyParsed = parsed.records.length > 0;

        set({
          sheetStatus: SHEET_STATUS.IDLE,
          sheetFiles: parsed.files,
          sheetError: anyParsed ? NOTHING_TO_LOAD_MESSAGE : null,
        });
        return;
      }

      const reference = buildReferenceEntries(sheetRecords);
      const preview =
        reference.entries.length > 0
          ? await previewReferenceLoad(reference.entries).catch(() => null)
          : null;

      set({
        sheetStatus: SHEET_STATUS.READY,
        sheetFiles: parsed.files,
        sheetReference: { ...reference, preview },
      });
    } catch {
      set({ sheetStatus: SHEET_STATUS.IDLE, sheetError: READ_FAILURE_MESSAGE });
    }
  },

  /**
   * A falha deixa a base como estava e o resumo na tela, com o motivo e os
   * botoes servindo de nova tentativa.
   */
  confirmSheet: async (mode = SHEET_LOAD_MODE.MERGE) => {
    const { sheetStatus, sheetReference } = get();

    if (sheetStatus !== SHEET_STATUS.READY || !sheetReference || sheetReference.entries.length === 0) {
      return;
    }

    set({ sheetStatus: SHEET_STATUS.WRITING, sheetError: null });

    try {
      const sheetResult =
        mode === SHEET_LOAD_MODE.REPLACE
          ? { mode, ...(await replaceReferenceBase(sheetReference.entries)) }
          : { mode: SHEET_LOAD_MODE.MERGE, ...(await mergeReferenceEntries(sheetReference.entries)) };

      set({ sheetStatus: SHEET_STATUS.DONE, sheetResult });
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
