import { useId, useState } from 'react';

import {
  INSTALLMENT_COUNT_MAX,
  INSTALLMENT_COUNT_MIN,
  describeCardText,
  parseInstallmentCount,
} from '../../domain/services/installmentPlan.js';

import Button from '../ui/Button.jsx';
import Field, { TextInput } from '../ui/Field.jsx';

import SettingCheckbox from './SettingCheckbox.jsx';

/**
 * Parcelas sem juros no cartao: so a quantidade de parcelas, guardada uma
 * vez para todos os produtos. Na etiqueta sai como texto, sem valor:
 * "10x sem juros no cartão".
 *
 * Mesmo desenho dos outros textos da etiqueta: sem cartao guardado, ou
 * alterando, aparece o campo com `Salvar`; com cartao guardado, aparece o
 * texto, a caixa que decide se ele sai, e `Alterar` e `Apagar`. Quantidade
 * fora dos limites nao e gravada, e o motivo fica embaixo do campo.
 */

function firstMessage(error) {
  return error?.issues?.[0]?.message ?? error?.message ?? 'Não foi possível guardar o cartão.';
}

export default function LabelCardSetting({ settings, onSave, onChange }) {
  const inputId = useId();
  const saved = Number.isInteger(settings.cardInstallments);
  const [editing, setEditing] = useState(!saved);
  const [draft, setDraft] = useState(saved ? String(settings.cardInstallments) : '');
  const [error, setError] = useState(null);

  function run(action) {
    try {
      action();
      setError(null);
      return true;
    } catch (failure) {
      setError(firstMessage(failure));
      return false;
    }
  }

  function handleSave(event) {
    event.preventDefault();

    if (run(() => onSave(parseInstallmentCount(draft)))) {
      setEditing(false);
    }
  }

  function handleEdit() {
    setDraft(String(settings.cardInstallments));
    setError(null);
    setEditing(true);
  }

  function handleCancel() {
    setDraft(String(settings.cardInstallments));
    setError(null);
    setEditing(false);
  }

  function handleClear() {
    if (run(() => onSave(null))) {
      setDraft('');
      setEditing(true);
    }
  }

  if (editing) {
    return (
      <form className="flex flex-col gap-2" onSubmit={handleSave} data-card-state="editing" noValidate>
        <Field
          id={inputId}
          label="Cartão sem juros"
          hint={`${INSTALLMENT_COUNT_MIN} a ${INSTALLMENT_COUNT_MAX} parcelas`}
          error={error}
          optional
        >
          {(control) => (
            <TextInput
              {...control}
              focus="brand"
              inputMode="numeric"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              placeholder="Ex.: 10"
              autoComplete="off"
              data-card-field="installments"
            />
          )}
        </Field>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" className="flex-1" disabled={draft.trim() === ''}>
            Salvar
          </Button>
          {saved ? (
            <Button type="button" className="flex-1" onClick={handleCancel}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-card-state="saved">
      <p className="text-rotulo font-semibold text-neutro-tinta">Cartão sem juros</p>

      <p
        className="break-words border border-neutro-borda bg-neutro-papel px-3 py-2 text-sm text-neutro-tinta"
        data-card-summary=""
      >
        {describeCardText(settings.cardInstallments)}
      </p>

      <SettingCheckbox
        label="Mostrar o cartão na etiqueta"
        checked={settings.showCardInstallments}
        onChange={(showCardInstallments) => run(() => onChange({ showCardInstallments }))}
      />

      {error ? <p className="text-xs text-marca-vermelhoTexto">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={handleEdit}>
          Alterar
        </Button>
        <Button type="button" variant="danger" className="flex-1" onClick={handleClear}>
          Apagar
        </Button>
      </div>
    </div>
  );
}
