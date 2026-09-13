import { create } from 'zustand';

import { parseImportFiles } from '../domain/services/importService.js';

/**
 * Estado do lote em leitura, separado do catalogo.
 *
 * O resultado do parsing precisa sobreviver entre a escolha dos arquivos, a
 * revisao do que foi lido e a decisao sobre o que gravar — etapas que nao
 * cabem num unico componente. E o catalogo em `useProductStore` continua sendo
 * so o catalogo: produtos ja gravados, leitura e as tres escritas unitarias.
 * Os dois se encontram no fim do fluxo, quando o lote aprovado passa pelo
 * repositorio de produtos e a listagem e relida.
 *
 * `files` cresce conforme cada arquivo termina, e nao ao fim do lote, para que
 * a tela acompanhe o progresso de uma selecao grande.
 */
export const useImportStore = create((set, get) => ({
  isParsing: false,
  files: [],
  records: [],

  reset: () => {
    set({ isParsing: false, files: [], records: [] });
  },

  parseFiles: async (selectedFiles) => {
    const selected = Array.from(selectedFiles ?? []);

    if (selected.length === 0) {
      return { records: [], files: [] };
    }

    set({ isParsing: true, files: [], records: [] });

    try {
      const result = await parseImportFiles(selected, {
        onFileSettled: (file) => {
          set({ files: [...get().files, file] });
        },
      });

      set({ records: result.records, files: result.files });

      return result;
    } finally {
      set({ isParsing: false });
    }
  },
}));
