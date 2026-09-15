import { create } from 'zustand';

import { DEFAULT_LABEL_LAYOUT_ID } from '../domain/services/labelLayoutCatalog.js';
import { ADJUSTABLE_SHEET_FIELDS } from '../domain/services/printJobBuilder.js';
import {
  DEFAULT_SHEET_LAYOUT_ID,
  findSheetLayout,
  getDefaultSheetLayout,
} from '../domain/services/sheetLayoutCatalog.js';

/**
 * Estado do trabalho de impressao que o operador esta montando.
 *
 * Transiente por decisao: nada daqui vai para o IndexedDB, e a pagina recarregada
 * comeca do zero. Persistir a selecao exigiria um segundo mecanismo de
 * armazenamento fora do contrato do banco, cuja versao nao muda; persistir so as
 * margens guardaria um ajuste de impressora em meio a dados de catalogo.
 *
 * O store guarda identificadores e texto, e nunca objetos de produto: o produto
 * desenhado sai sempre da lista atual, resolvido por `resolvePrintItems`. Os
 * campos numericos guardam o texto digitado pelo mesmo motivo que o formulario
 * de produto guarda: o estado intermediario de quem esta redigitando nao e um
 * numero, e coagi-lo faria o campo corrigir sozinho o que ainda esta sendo
 * escrito.
 *
 * A selecao e uma lista, e nao um mapa: a ordem em que o operador marcou e a
 * ordem em que ele le a propria selecao de volta.
 */

/** Texto inicial dos seis campos ajustaveis, a partir do modelo de folha. */
function adjustmentsFromLayout(layout) {
  const adjustments = {};

  ADJUSTABLE_SHEET_FIELDS.forEach((field) => {
    adjustments[field] = String(layout[field]).replace('.', ',');
  });

  return adjustments;
}

function initialState() {
  return {
    selection: [],
    labelLayoutId: DEFAULT_LABEL_LAYOUT_ID,
    sheetLayoutId: DEFAULT_SHEET_LAYOUT_ID,
    sheetAdjustments: adjustmentsFromLayout(getDefaultSheetLayout()),
  };
}

export const usePrintJobStore = create((set, get) => ({
  ...initialState(),

  // Marcar e desmarcar sao a mesma acao: a listagem tem uma caixa por item, e o
  // clique nela alterna. Marcar de novo um produto ja marcado nao repoe a
  // quantidade que o operador digitou.
  toggleProduct: (productId) => {
    const { selection } = get();
    const alreadySelected = selection.some((entry) => entry.productId === productId);

    if (alreadySelected) {
      set({ selection: selection.filter((entry) => entry.productId !== productId) });
      return;
    }

    set({ selection: [...selection, { productId, copies: '1' }] });
  },

  setCopies: (productId, copies) => {
    set({
      selection: get().selection.map((entry) =>
        entry.productId === productId ? { ...entry, copies } : entry,
      ),
    });
  },

  setLabelLayoutId: (labelLayoutId) => {
    set({ labelLayoutId });
  },

  // Trocar de folha repoe os seis numeros do modelo novo. Manter os ajustes da
  // folha anterior levaria uma margem pensada para retrato a uma folha em
  // paisagem sem que ninguem tivesse pedido isso.
  setSheetLayoutId: (sheetLayoutId) => {
    const layout = findSheetLayout(sheetLayoutId);

    if (!layout) {
      return;
    }

    set({ sheetLayoutId, sheetAdjustments: adjustmentsFromLayout(layout) });
  },

  setSheetAdjustment: (field, value) => {
    if (!ADJUSTABLE_SHEET_FIELDS.includes(field)) {
      return;
    }

    set({ sheetAdjustments: { ...get().sheetAdjustments, [field]: value } });
  },

  clearSelection: () => {
    set({ selection: [] });
  },

  // Volta a folha, o modelo e a selecao ao ponto de partida.
  resetPrintJob: () => {
    set(initialState());
  },
}));
