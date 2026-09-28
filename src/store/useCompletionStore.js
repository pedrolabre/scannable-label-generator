import { create } from 'zustand';

import { planCatalogCompletion } from '../domain/services/catalogCompletion.js';
import {
  COMPLETION_FILE_EXTENSIONS,
  parseImportFiles,
} from '../domain/services/importService.js';
import { listProducts, updateProducts } from '../storage/productRepository.js';
import { describeStorageError, describeStorageReadError } from '../storage/storageError.js';

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
    error: null,
  };
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
    const { status, records } = get();

    if (status !== COMPLETION_STATUS.READY) {
      return;
    }

    set({ status: COMPLETION_STATUS.WRITING, error: null });

    try {
      const plan = planCatalogCompletion(await listProducts(), records);

      await updateProducts(plan.products);

      set({ status: COMPLETION_STATUS.DONE, plan, result: plan.summary });
    } catch (error) {
      set({ status: COMPLETION_STATUS.READY, error: describeStorageError(error) });
      return;
    }

    // A releitura falhando nao desfaz a gravacao, que ja terminou: o motivo
    // fica em `loadError`, e a listagem o exibe com a acao de tentar de novo.
    await useProductStore
      .getState()
      .loadProducts()
      .catch(() => {});
  },
}));
