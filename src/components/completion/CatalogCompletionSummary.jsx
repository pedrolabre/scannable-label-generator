import { CheckCircle2 } from 'lucide-react';

import { COMPLETABLE_FIELDS } from '../../domain/services/catalogCompletion.js';
import { formatCount, pluralize } from '../import/importCounts.js';

/**
 * Resumo da complementacao: o que muda, o que fica como esta e o que o arquivo
 * trouxe que nao serve, antes de qualquer gravacao — e depois dela, como
 * resultado.
 *
 * As linhas por campo so aparecem para o campo que o arquivo trouxe. Um
 * relatorio sem codigo de barras nao ganha uma linha de codigo de barras com
 * tres zeros, que so ocuparia lugar. As contagens de codigo repetido e de
 * codigo que aponta para mais de um produto seguem a mesma regra.
 */

export const FIELD_LABELS = Object.freeze({
  description: 'Descrição',
  ean: 'Código de barras',
  ncm: 'NCM',
  category: 'Categoria',
  notes: 'Observações',
});

function fieldLine(summary, field) {
  const gained = summary.gainedByField[field];
  const filled = summary.filledByField[field];
  const invalid = summary.invalidByField[field];

  if (gained + filled + invalid === 0) {
    return null;
  }

  const parts = [pluralize(gained, 'a preencher', 'a preencher')];

  if (filled > 0) {
    parts.push(pluralize(filled, 'já preenchido', 'já preenchidos'));
  }

  if (invalid > 0) {
    parts.push(pluralize(invalid, 'valor inválido ignorado', 'valores inválidos ignorados'));
  }

  return { field, text: `${FIELD_LABELS[field]}: ${parts.join(', ')}` };
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-neutro-tintaFraca">{label}</dt>
      <dd className="font-semibold tabular-nums text-neutro-tintaMedia">{formatCount(value)}</dd>
    </div>
  );
}

export default function CatalogCompletionSummary({ summary, isDone }) {
  const fieldLines = COMPLETABLE_FIELDS.map((field) => fieldLine(summary, field)).filter(Boolean);

  return (
    <div className="space-y-3" data-resumo-complementacao="">
      {isDone ? (
        <p role="status" className="flex items-center gap-2 text-sm text-marca-verdeTexto">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {summary.updatedProducts === 1
            ? '1 produto completado.'
            : `${formatCount(summary.updatedProducts)} produtos completados.`}
        </p>
      ) : (
        <p role="status" className="text-sm font-semibold text-neutro-tintaMedia">
          {summary.updatedProducts === 0
            ? 'Nenhum produto do catálogo tem campo vazio que estes arquivos preencham.'
            : `${pluralize(summary.updatedProducts, 'produto ganha', 'produtos ganham')} dados. Nada foi gravado ainda.`}
        </p>
      )}

      <dl className="divide-y divide-neutro-divisor border-y border-neutro-divisor text-sm">
        <Line label="Produtos que ganham algum campo" value={summary.updatedProducts} />
        <Line label="Produtos que já estavam completos" value={summary.alreadyComplete} />
        <Line label="Códigos fora do catálogo" value={summary.outsideCatalog} />
        {summary.repeatedInFile > 0 ? (
          <Line label="Códigos repetidos nos arquivos" value={summary.repeatedInFile} />
        ) : null}
        {summary.ambiguousCodes > 0 ? (
          <Line label="Códigos com mais de um produto no catálogo" value={summary.ambiguousCodes} />
        ) : null}
      </dl>

      {fieldLines.length > 0 ? (
        <ul aria-label="Campos" className="space-y-1 text-sm text-neutro-tintaMedia">
          {fieldLines.map((line) => (
            <li key={line.field}>{line.text}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
