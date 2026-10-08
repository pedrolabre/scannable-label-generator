import { create } from 'zustand';

import { planCatalogCompletion } from '../domain/services/catalogCompletion.js';
import {
  COMPLETION_FILE_EXTENSIONS,
  parseImportFiles,
} from '../domain/services/importService.js';
import { buildReferenceEntries, selectReferenceRecords } from '../domain/services/referenceEntries.js';
import { listProducts, updateProducts } from '../storage/productRepository.js';
import { mergeReferenceEntries, previewReferenceLoad } from '../storage/referenceRepository.js';
import { describeStorageError, describeStorageReadError } from '../storage/storageError.js';

import { DIVERGENCE_STATUS, writeDivergenceChoices } from './divergenceWrite.js';
import { useProductStore } from './useProductStore.js';

/**
 * Estado da complementacao do catalogo, separado do lote de importacao.
 *
 * Os dois caminhos leem arquivos pela mesma entrada, mas terminam em lugares
 * diferentes: a importacao confere, detecta codigo repetido e cria produtos; a
 * complementacao so compara com o catalogo e preenche campos vazios. Um estado
 * so para os dois misturaria um lote que vai virar produto com um arquivo que
 * nunca vira.
 *
 * A sequencia tem uma pausa no meio, como a restauracao do backup: ler os
 * arquivos, comparar com o catalogo e mostrar o resumo, **esperar a
 * confirmacao** e so entao gravar. Ate a confirmacao nada foi gravado.
 *
 * Na confirmacao o catalogo e lido de novo e a comparacao e refeita sobre ele:
 * entre o resumo e o clique, outra aba pode ter gravado no mesmo banco, e o que
 * vale e o catalogo do momento da gravacao. A gravacao e uma transacao so; quando
 * ela falha, nenhum produto muda e o resumo continua na tela, com o motivo e o
 * botao de confirmar servindo de nova tentativa.
 *
 * Como na importacao, fechar o dialogo nao descarta o que foi lido.
 *
 * ## A base de referencia
 *
 * O arquivo em colunas que traz NCM ou codigo de barras tambem alimenta a base
 * de referencia. As linhas sao montadas na leitura e gravadas na mesma
 * confirmacao, depois do catalogo, atualizando a base codigo por codigo.
 *
 * Como a base vale mesmo com o catalogo vazio, a confirmacao fica disponivel
 * quando ha produto a completar ou linha a guardar na base.
 *
 * As divergencias ficam fora da confirmacao: so as escolhidas no dialogo
 * proprio sao gravadas, por `applyDivergences`.
 */

export const COMPLETION_STATUS = Object.freeze({
  IDLE: 'idle',
  READING: 'reading',
  READY: 'ready',
  WRITING: 'writing',
  DONE: 'done',
});

const READ_FAILURE_MESSAGE = 'Não foi possível ler os arquivos escolhidos. Tente de novo.';

function initialState() {
  return {
    status: COMPLETION_STATUS.IDLE,
    files: [],
    records: [],
    plan: null,
    result: null,
    reference: null,
    referenceResult: null,
    error: null,
    divergenceStatus: DIVERGENCE_STATUS.IDLE,
    divergenceResult: null,
    divergenceError: null,
  };
}

/** Linhas da base e a previa da carga; a previa falhando so deixa de aparecer. */
async function planReference(records) {
  const selected = selectReferenceRecords(records);

  if (selected.length === 0) {
    return null;
  }

  const reference = buildReferenceEntries(selected);
  let preview = null;

  if (reference.entries.length > 0) {
    preview = await previewReferenceLoad(reference.entries).catch(() => null);
  }

  return { ...reference, preview };
}

export const useCompletionStore = create((set, get) => ({
  ...initialState(),

  reset: () => {
    set(initialState());
  },

  readFiles: async (selectedFiles) => {
    const selected = Array.from(selectedFiles ?? []);

    if (selected.length === 0 || get().status === COMPLETION_STATUS.READING) {
      return;
    }

    set({ ...initialState(), status: COMPLETION_STATUS.READING });

    let parsed;

    try {
      parsed = await parseImportFiles(selected, {
        acceptedExtensions: COMPLETION_FILE_EXTENSIONS,
        onFileSettled: (file) => {
          set({ files: [...get().files, file] });
        },
      });
    } catch {
      set({ status: COMPLETION_STATUS.IDLE, error: READ_FAILURE_MESSAGE });
      return;
    }

    try {
      const products = await listProducts();

      set({
        status: COMPLETION_STATUS.READY,
        files: parsed.files,
        records: parsed.records,
        plan: planCatalogCompletion(products, parsed.records),
        reference: await planReference(parsed.records),
      });
    } catch (error) {
      set({
        status: COMPLETION_STATUS.IDLE,
        files: parsed.files,
        error: describeStorageReadError(error),
      });
    }
  },

  confirm: async () => {
    const { status, records, reference } = get();

    if (status !== COMPLETION_STATUS.READY) {
      return;
    }

    set({ status: COMPLETION_STATUS.WRITING, error: null });

    let catalogChanged = false;

    try {
      const plan = planCatalogCompletion(await listProducts(), records);

      await updateProducts(plan.products);
      catalogChanged = plan.products.length > 0;

      const referenceResult =
        reference && reference.entries.length > 0
          ? await mergeReferenceEntries(reference.entries)
          : null;

      set({ status: COMPLETION_STATUS.DONE, plan, result: plan.summary, referenceResult });
    } catch (error) {
      set({ status: COMPLETION_STATUS.READY, error: describeStorageError(error) });

      // O catalogo gravado antes da falha da base continua gravado; a
      // listagem e relida para mostra-lo.
      if (!catalogChanged) {
        return;
      }
    }

    // A releitura falhando nao desfaz a gravacao, que ja terminou: o motivo
    // fica em `loadError`, e a listagem o exibe com a acao de tentar de novo.
    await useProductStore
      .getState()
      .loadProducts()
      .catch(() => {});
  },

  applyDivergences: async (chosenIds) => {
    const { plan, records, divergenceStatus } = get();

    if (!plan || divergenceStatus === DIVERGENCE_STATUS.APPLYING || chosenIds.length === 0) {
      return;
    }

    set({ divergenceStatus: DIVERGENCE_STATUS.APPLYING, divergenceError: null, divergenceResult: null });

    try {
      const summary = await writeDivergenceChoices(plan.divergences, chosenIds);
      const fresh = planCatalogCompletion(await listProducts(), records);

      set({
        divergenceStatus: DIVERGENCE_STATUS.IDLE,
        divergenceResult: summary,
        plan: { ...get().plan, divergences: fresh.divergences },
      });
    } catch (error) {
      set({ divergenceStatus: DIVERGENCE_STATUS.IDLE, divergenceError: describeStorageError(error) });
    }
  },
}));
