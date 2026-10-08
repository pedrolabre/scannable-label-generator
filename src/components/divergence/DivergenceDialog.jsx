import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { formatCentavosAsBRL } from '../../lib/currency.js';
import { formatCount, pluralize } from '../import/importCounts.js';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';
import ModalShell from '../ui/ModalShell.jsx';
import SegmentedControl from '../ui/SegmentedControl.jsx';

/**
 * Revisao das divergencias, item por item, com tudo aberto em Manter. `Mudar
 * todos` e `Manter todos` valem para o filtro aberto, em todas as paginas.
 * Dividido pelo Completar dados e pela base; `incomingLabel` diz de onde vem o
 * valor novo.
 */

const PAGE_SIZE = 50;

export const DIVERGENCE_FIELD_LABELS = Object.freeze({
  description: 'Descrição',
  priceInCentavos: 'Preço',
  ncm: 'NCM',
});

const ALL = 'all';
const KEEP = 'keep';
const CHANGE = 'change';

const CHOICE_OPTIONS = [
  { value: KEEP, label: 'Manter' },
  { value: CHANGE, label: 'Mudar' },
];

export function formatDivergenceValue(field, value) {
  if (field === 'priceInCentavos') {
    return formatCentavosAsBRL(value) ?? String(value);
  }

  return String(value);
}

function countByField(divergences) {
  const counts = new Map();

  for (const divergence of divergences) {
    counts.set(divergence.field, (counts.get(divergence.field) ?? 0) + 1);
  }

  return counts;
}

function resultSentence(result) {
  const updated =
    result.updatedProducts === 1
      ? '1 produto atualizado.'
      : `${formatCount(result.updatedProducts)} produtos atualizados.`;

  if (result.stale === 0) {
    return updated;
  }

  const stale = pluralize(result.stale, 'escolha não foi aplicada', 'escolhas não foram aplicadas');

  return `${updated} ${stale} porque o produto mudou antes da gravação.`;
}

function DivergenceRow({ divergence, choice, incomingLabel, onChoose }) {
  const label = DIVERGENCE_FIELD_LABELS[divergence.field];

  return (
    <li className="space-y-2 py-3" data-divergencia={divergence.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 text-sm font-semibold text-neutro-tinta">
          <span className="tabular-nums">{divergence.systemCode}</span>
          <span aria-hidden="true">{' · '}</span>
          {divergence.displayName}
        </p>
        <p className="text-rotulo font-semibold uppercase text-neutro-tintaFraca">{label}</p>
      </div>

      <dl className="grid gap-1 text-sm sm:grid-cols-2 sm:gap-3">
        <div className="min-w-0">
          <dt className="text-rotulo text-neutro-tintaFraca">Cadastrado</dt>
          <dd className="break-words text-neutro-tintaMedia" data-valor-cadastrado="">
            {formatDivergenceValue(divergence.field, divergence.current)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-rotulo text-neutro-tintaFraca">{incomingLabel}</dt>
          <dd className="break-words font-semibold text-neutro-tinta" data-valor-novo="">
            {formatDivergenceValue(divergence.field, divergence.incoming)}
          </dd>
        </div>
      </dl>

      <SegmentedControl
        legend={`${label} de ${divergence.systemCode}`}
        hideLegend
        name={`divergencia-${divergence.id}`}
        options={CHOICE_OPTIONS}
        value={choice}
        onChange={(next) => onChoose(divergence.id, next)}
      />
    </li>
  );
}

export default function DivergenceDialog({
  divergences,
  subtitle = 'Valores do arquivo diferentes dos cadastrados.',
  incomingLabel = 'No arquivo',
  isApplying = false,
  result = null,
  error = null,
  onApply,
  onClose,
}) {
  const [changed, setChanged] = useState(() => new Set());
  const [filter, setFilter] = useState(ALL);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setChanged(new Set());
    setPageIndex(0);
  }, [divergences]);

  const counts = useMemo(() => countByField(divergences), [divergences]);
  const activeFilter = filter === ALL || counts.has(filter) ? filter : ALL;
  const visible = useMemo(
    () =>
      activeFilter === ALL
        ? divergences
        : divergences.filter((divergence) => divergence.field === activeFilter),
    [divergences, activeFilter],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(pageIndex, totalPages - 1);
  const pageItems = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const markedCount = divergences.filter((divergence) => changed.has(divergence.id)).length;

  const filterOptions = [
    { value: ALL, label: `Todos (${formatCount(divergences.length)})` },
    ...Object.keys(DIVERGENCE_FIELD_LABELS)
      .filter((field) => counts.has(field))
      .map((field) => ({
        value: field,
        label: `${DIVERGENCE_FIELD_LABELS[field]} (${formatCount(counts.get(field))})`,
      })),
  ];

  function choose(id, next) {
    setChanged((current) => {
      const updated = new Set(current);

      if (next === CHANGE) {
        updated.add(id);
      } else {
        updated.delete(id);
      }

      return updated;
    });
  }

  function chooseVisible(next) {
    setChanged((current) => {
      const updated = new Set(current);

      for (const divergence of visible) {
        if (next === CHANGE) {
          updated.add(divergence.id);
        } else {
          updated.delete(divergence.id);
        }
      }

      return updated;
    });
  }

  function handleFilter(next) {
    setFilter(next);
    setPageIndex(0);
  }

  function handleApply() {
    onApply(divergences.filter((divergence) => changed.has(divergence.id)).map((divergence) => divergence.id));
  }

  return (
    <ModalShell
      title="Divergências"
      subtitle={subtitle}
      width={720}
      closeOnBackdrop={false}
      onClose={onClose}
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={isApplying}>
            Fechar
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleApply}
            disabled={isApplying || markedCount === 0}
          >
            {isApplying ? 'Gravando…' : 'Aplicar escolhas'}
          </Button>
        </>
      }
    >
      <div className="space-y-4" data-divergencias="">
        {result ? (
          <p role="status" className="flex items-center gap-2 text-sm text-marca-verdeTexto">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {resultSentence(result)}
          </p>
        ) : null}

        {error ? <InlineAlert>{error}</InlineAlert> : null}

        {divergences.length === 0 ? (
          <p className="text-sm text-neutro-tintaMedia">Nenhuma divergência para revisar.</p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-neutro-tintaMedia">
              Cada item abre em Manter. Marque Mudar no que deve receber o valor novo e aplique as
              escolhas; o resto fica como está.
              {counts.has('description')
                ? ' Mudar a descrição também refaz o nome da etiqueta a partir dela.'
                : null}
            </p>

            {filterOptions.length > 2 ? (
              <SegmentedControl
                legend="Mostrar"
                name="divergencias-filtro"
                options={filterOptions}
                value={activeFilter}
                onChange={handleFilter}
              />
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-neutro-tintaFraca" aria-live="polite" data-marcadas="">
                {markedCount === 0
                  ? 'Nenhum item marcado para mudar.'
                  : `${pluralize(markedCount, 'item marcado', 'itens marcados')} para mudar.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => chooseVisible(CHANGE)} disabled={isApplying}>
                  Mudar todos
                </Button>
                <Button type="button" onClick={() => chooseVisible(KEEP)} disabled={isApplying}>
                  Manter todos
                </Button>
              </div>
            </div>

            <ul className="divide-y divide-neutro-divisor border-y border-neutro-divisor">
              {pageItems.map((divergence) => (
                <DivergenceRow
                  key={divergence.id}
                  divergence={divergence}
                  choice={changed.has(divergence.id) ? CHANGE : KEEP}
                  incomingLabel={incomingLabel}
                  onChoose={choose}
                />
              ))}
            </ul>

            {totalPages > 1 ? (
              <nav aria-label="Páginas das divergências" className="flex items-center justify-between gap-3">
                <Button
                  aria-label="Anterior: ir para a página anterior"
                  disabled={page <= 0}
                  onClick={() => setPageIndex(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span className="max-sm:sr-only">Anterior</span>
                </Button>
                <p className="text-sm tabular-nums text-neutro-tintaFraca" aria-live="polite">
                  {`Página ${page + 1} de ${totalPages}`}
                </p>
                <Button
                  aria-label="Próxima: ir para a próxima página"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPageIndex(page + 1)}
                >
                  <span className="max-sm:sr-only">Próxima</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </ModalShell>
  );
}
