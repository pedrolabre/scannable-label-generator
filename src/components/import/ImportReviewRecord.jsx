import { describeImportOrigin } from '../../domain/services/importRecord.js';
import { RECORD_STATUS_REFUSED } from '../../domain/services/importReport.js';
import { ISSUE_DISPLAY_NAME_TRUNCATED } from '../../domain/services/productCandidateIssue.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';
import { cx } from '../../lib/cx.js';

import ImportDisplayNameField from './ImportDisplayNameField.jsx';
import ImportRecordIssueList from './ImportRecordIssueList.jsx';

/**
 * Um registro do lote na revisao.
 *
 * A ordem da linha segue a ordem em que a duvida aparece: de onde veio o
 * registro, que nome ele vai levar, e o que impede ou recomenda conferir. A
 * frase de origem vem pronta de `describeImportOrigin`, e nao e remontada aqui.
 *
 * Quando o nome veio de um corte, o texto completo aparece logo abaixo do
 * campo: e nele que esta a diferenca entre duas variantes do mesmo produto, e
 * sem ele o corte nao tem como ser conferido.
 */
function StatusBadge({ status }) {
  const refused = status === RECORD_STATUS_REFUSED;

  return (
    <span
      className={cx(
        'shrink-0 rounded-[2px] border px-2 py-0.5 text-xs font-semibold',
        refused
          ? 'border-[#b93a20] bg-[#fff1ea] text-[#b93a20] dark:border-[#ffb8a7] dark:bg-[#3b211b] dark:text-[#ffb8a7]'
          : 'border-[#8a5a00] bg-[#fdf6e3] text-[#8a5a00] dark:border-[#f4c95f] dark:bg-[#3a2f16] dark:text-[#f4c95f]',
      )}
    >
      {refused ? 'Recusado' : 'Conferir'}
    </span>
  );
}

function hasTruncatedName(record) {
  return record.candidateIssues.some((issue) => issue.code === ISSUE_DISPLAY_NAME_TRUNCATED);
}

function displayNameError(entry) {
  const line = entry.lines.find((item) => item.field === 'displayName' && item.blocking);

  return line ? line.message : null;
}

export default function ImportReviewRecord({ record, entry, correction, onCorrect, onRevert }) {
  const nameError = displayNameError(entry);
  const currentName = correction?.displayName ?? record.candidate.displayName ?? '';
  const price = record.candidate.priceInCentavos;
  const description = record.candidate.description;

  // A linha do nome ja mostra a recusa do proprio nome; repeti-la na lista
  // abaixo seria a mesma frase duas vezes na mesma linha.
  const lines = entry.lines.filter((line) => !(line.field === 'displayName' && line.blocking));

  return (
    <li className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={entry.status} />

        <p className="min-w-0 truncate text-sm text-slate-600 dark:text-slate-300">
          {describeImportOrigin(record)}
        </p>

        {record.candidate.systemCode ? (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {record.candidate.systemCode}
          </span>
        ) : null}

        {typeof price === 'number' ? (
          <span className="ml-auto text-sm font-semibold tabular-nums text-[#159447]">
            {formatCentavosAsBRL(price)}
          </span>
        ) : null}
      </div>

      <ImportDisplayNameField
        recordId={record.recordId}
        value={currentName}
        originalValue={record.candidate.displayName ?? ''}
        corrected={Boolean(correction?.displayName !== undefined)}
        error={nameError}
        onChange={(value) => onCorrect(record.recordId, 'displayName', value)}
        onRevert={() => onRevert(record.recordId)}
      />

      {hasTruncatedName(record) && description ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Texto completo do produto:{' '}
          <span className="text-slate-800 dark:text-slate-100">{description}</span>
        </p>
      ) : null}

      <ImportRecordIssueList lines={lines} />
    </li>
  );
}
