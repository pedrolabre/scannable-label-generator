import { create } from 'zustand';

import {
  applyCorrection,
  clearCorrection,
  correctionFor,
  resolveCandidate,
} from '../domain/services/importCorrection.js';
import {
  createImportReport,
  describeRecord,
  pushRecordReport,
  replaceRecordReport,
} from '../domain/services/importReport.js';
import { parseImportFiles } from '../domain/services/importService.js';
import { validateCandidate, validateImportRecords } from '../domain/services/importValidation.js';

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
 *
 * A conferencia vem logo depois da leitura, na mesma acao: o relatorio comeca
 * por uma contagem, e contagem nao existe sem ter conferido tudo. Durante a
 * varredura so `checkedCount` e publicado; o relatorio inteiro entra no estado
 * uma vez, ao fim, porque publicar a cada fatia redesenharia a tela cem vezes
 * sem ter o que mostrar ainda.
 *
 * A correcao do usuario nao volta ao registro: ela mora em `corrections`, e a
 * reconferencia atinge um registro so — o corrigido —, nunca o lote.
 */
export const useImportStore = create((set, get) => ({
  isParsing: false,
  isChecking: false,
  checkedCount: 0,
  files: [],
  records: [],
  report: null,
  corrections: {},

  reset: () => {
    set({
      isParsing: false,
      isChecking: false,
      checkedCount: 0,
      files: [],
      records: [],
      report: null,
      corrections: {},
    });
  },

  parseFiles: async (selectedFiles) => {
    const selected = Array.from(selectedFiles ?? []);

    if (selected.length === 0) {
      return { records: [], files: [] };
    }

    set({
      isParsing: true,
      isChecking: false,
      checkedCount: 0,
      files: [],
      records: [],
      report: null,
      corrections: {},
    });

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

      set({ report });

      return result;
    } finally {
      set({ isParsing: false, isChecking: false });
    }
  },

  correctRecord: (recordId, field, value) => {
    const { records, corrections, report } = get();
    const entry = report?.entries.get(recordId);

    if (!entry) {
      return;
    }

    const record = records[entry.index];
    const nextCorrections = applyCorrection(corrections, record, field, value);
    const correction = correctionFor(nextCorrections, recordId);
    const validation = validateCandidate(resolveCandidate(record, correction));

    set({
      corrections: nextCorrections,
      report: replaceRecordReport(report, describeRecord(record, validation, entry.index, correction)),
    });
  },

  revertRecord: (recordId) => {
    const { records, corrections, report } = get();
    const entry = report?.entries.get(recordId);

    if (!entry || !corrections[recordId]) {
      return;
    }

    const record = records[entry.index];
    const nextCorrections = clearCorrection(corrections, recordId);
    const validation = validateCandidate(record.candidate);

    set({
      corrections: nextCorrections,
      report: replaceRecordReport(report, describeRecord(record, validation, entry.index)),
    });
  },
}));
