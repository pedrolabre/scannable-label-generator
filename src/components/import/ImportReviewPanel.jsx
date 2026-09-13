import { useCallback, useEffect, useState } from 'react';

import { takeReviewEntries } from '../../domain/services/importReport.js';
import { useImportStore } from '../../store/useImportStore.js';
import Button from '../ui/Button.jsx';

import ImportReviewRecord from './ImportReviewRecord.jsx';
import ImportReviewSummary from './ImportReviewSummary.jsx';
import { formatCount, pluralize } from './importCounts.js';

/**
 * Revisao do lote conferido.
 *
 * A tela mostra so os registros que tem algo a dizer; os que estao prontos
 * viram um numero na frase de resumo. Com 200 mil registros e tres recusados, a
 * revisao sao tres linhas — e e essa a razao da escolha: uma tabela de todos os
 * registros precisaria de uma janela deslizante para caber, e o caminho comum,
 * medido nas notas reais, e o registro passar sem ressalva nenhuma.
 *
 * O teto de linhas nao e enfeite. Um lote inteiro pode ser recusado de uma vez
 * — basta uma planilha com os nomes de coluna errados — e ai a lista de motivos
 * tem o tamanho do lote. O botao abre mais um bloco por vez.
 */
const REVIEW_PAGE_SIZE = 200;

export default function ImportReviewPanel() {
  const records = useImportStore((state) => state.records);
  const report = useImportStore((state) => state.report);
  const isChecking = useImportStore((state) => state.isChecking);
  const checkedCount = useImportStore((state) => state.checkedCount);
  const corrections = useImportStore((state) => state.corrections);
  const correctRecord = useImportStore((state) => state.correctRecord);
  const revertRecord = useImportStore((state) => state.revertRecord);

  const [visibleCount, setVisibleCount] = useState(REVIEW_PAGE_SIZE);

  // O teto volta ao inicio a cada lote novo, e nao a cada correcao: corrigir um
  // nome nao pode encolher a lista que o usuario acabou de abrir.
  useEffect(() => {
    setVisibleCount(REVIEW_PAGE_SIZE);
  }, [records]);

  const handleShowMore = useCallback(() => {
    setVisibleCount((current) => current + REVIEW_PAGE_SIZE);
  }, []);

  if (isChecking) {
    return (
      <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
        Conferindo {formatCount(checkedCount)} de {formatCount(records.length)} registros…
      </p>
    );
  }

  if (!report) {
    return null;
  }

  const entries = takeReviewEntries(report, visibleCount);
  const remaining = report.reviewIds.length - entries.length;

  return (
    <div className="space-y-3">
      <ImportReviewSummary report={report} />

      {entries.length > 0 ? (
        <ul
          aria-label="Registros para revisão"
          className="divide-y divide-slate-200 rounded-[3px] border border-slate-200 dark:divide-slate-800 dark:border-slate-800"
        >
          {entries.map((entry) => (
            <ImportReviewRecord
              key={entry.recordId}
              record={records[entry.index]}
              entry={entry}
              correction={corrections[entry.recordId] ?? null}
              onCorrect={correctRecord}
              onRevert={revertRecord}
            />
          ))}
        </ul>
      ) : null}

      {remaining > 0 ? (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={handleShowMore}>
            Mostrar mais
          </Button>

          <p className="text-sm text-slate-600 dark:text-slate-300">
            {pluralize(remaining, 'registro ainda não exibido', 'registros ainda não exibidos')}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
