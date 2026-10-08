import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

import { DIVERGENCE_STATUS } from '../../store/divergenceWrite.js';
import { COMPLETION_FROM_BASE_STATUS } from '../../store/referenceCompletionSlice.js';
import { useReferenceStore } from '../../store/useReferenceStore.js';
import DivergenceDialog from '../divergence/DivergenceDialog.jsx';
import { formatCount, pluralize } from '../import/importCounts.js';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

/**
 * Completar o catalogo pela base guardada, sem arquivo.
 *
 * Serve ao produto que entrou sem passar pela importacao — cadastrado a mao,
 * restaurado de um backup, importado antes de a base existir. Conferir mostra
 * o resumo, e so o segundo botao grava. Codigo do catalogo que nao esta na
 * base e contado a parte, porque nao e erro: so nao ha o que completar.
 */

function headline(summary, isDone) {
  if (isDone) {
    return summary.updatedProducts === 1
      ? '1 produto completado.'
      : `${formatCount(summary.updatedProducts)} produtos completados.`;
  }

  if (summary.askedCodes === 0) {
    return 'Nenhum produto do catálogo está sem NCM ou sem código de barras.';
  }

  if (summary.updatedProducts === 0) {
    return 'A base não tem dado para nenhum produto sem NCM ou sem código de barras.';
  }

  const gaining = pluralize(summary.updatedProducts, 'produto ganha', 'produtos ganham');

  return `${gaining} dados da base. Nada foi gravado ainda.`;
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-neutro-tintaFraca">{label}</dt>
      <dd className="font-semibold tabular-nums text-neutro-tintaMedia">{formatCount(value)}</dd>
    </div>
  );
}

function CompletionSummary({ summary, isDone }) {
  return (
    <div className="space-y-2" data-resumo-completar-base="">
      <p
        role="status"
        className={
          isDone
            ? 'flex items-center gap-2 text-sm text-marca-verdeTexto'
            : 'text-sm font-semibold text-neutro-tintaMedia'
        }
      >
        {isDone ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
        {headline(summary, isDone)}
      </p>

      {summary.askedCodes > 0 ? (
        <dl className="divide-y divide-neutro-divisor border-y border-neutro-divisor text-sm">
          <Line label="Produtos sem NCM ou sem código de barras" value={summary.askedCodes} />
          <Line label="Ganham NCM" value={summary.gainedByField.ncm} />
          <Line label="Ganham código de barras" value={summary.gainedByField.ean} />
          <Line label="Códigos fora da base" value={summary.outsideReference} />
        </dl>
      ) : null}
    </div>
  );
}

export default function ReferenceCompletionSection({ isBaseEmpty }) {
  const status = useReferenceStore((state) => state.completionStatus);
  const plan = useReferenceStore((state) => state.completionPlan);
  const error = useReferenceStore((state) => state.completionError);
  const checkCompletion = useReferenceStore((state) => state.checkCompletion);
  const confirmCompletion = useReferenceStore((state) => state.confirmCompletion);
  const divergenceStatus = useReferenceStore((state) => state.divergenceStatus);
  const divergenceResult = useReferenceStore((state) => state.divergenceResult);
  const divergenceError = useReferenceStore((state) => state.divergenceError);
  const applyDivergences = useReferenceStore((state) => state.applyCompletionDivergences);
  const [isReviewing, setIsReviewing] = useState(false);

  const isChecking = status === COMPLETION_FROM_BASE_STATUS.CHECKING;
  const isWriting = status === COMPLETION_FROM_BASE_STATUS.WRITING;
  const summary = plan?.summary ?? null;
  const canConfirm =
    (status === COMPLETION_FROM_BASE_STATUS.READY || isWriting) && summary?.updatedProducts > 0;
  const divergences = plan?.divergences ?? [];
  const canReview = !isChecking && divergences.length > 0;

  return (
    <section aria-labelledby="base-completar" className="space-y-3">
      <h3 id="base-completar" className="text-base font-semibold">
        Completar o catálogo pela base
      </h3>

      <p className="text-sm leading-relaxed text-neutro-tintaMedia">
        Procura na base os produtos já cadastrados sem NCM ou sem código de barras e preenche só o
        campo vazio. NCM diferente do cadastrado aparece em Divergências. Nenhum produto é criado,
        e nada é gravado antes da confirmação.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={checkCompletion} disabled={isBaseEmpty || isChecking || isWriting}>
          {isChecking ? 'Conferindo…' : 'Conferir o catálogo'}
        </Button>

        {canConfirm ? (
          <Button type="button" variant="primary" onClick={confirmCompletion} disabled={isWriting}>
            {isWriting ? 'Gravando…' : 'Completar catálogo'}
          </Button>
        ) : null}

        {canReview ? (
          <Button type="button" onClick={() => setIsReviewing(true)} disabled={isWriting}>
            {`Divergências (${divergences.length.toLocaleString('pt-BR')})`}
          </Button>
        ) : null}
      </div>

      {error ? <InlineAlert>{error}</InlineAlert> : null}

      {summary && !isChecking ? (
        <CompletionSummary summary={summary} isDone={status === COMPLETION_FROM_BASE_STATUS.DONE} />
      ) : null}

      {isReviewing ? (
        <DivergenceDialog
          divergences={divergences}
          subtitle="NCM da base diferente do cadastrado."
          incomingLabel="Na base"
          isApplying={divergenceStatus === DIVERGENCE_STATUS.APPLYING}
          result={divergenceResult}
          error={divergenceError}
          onApply={applyDivergences}
          onClose={() => setIsReviewing(false)}
        />
      ) : null}
    </section>
  );
}
