import { useId, useState } from 'react';

import { cx } from '../../lib/cx.js';

import Button from '../ui/Button.jsx';
import Field, { TextInput } from '../ui/Field.jsx';
import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from '../ui/focusClasses.js';

/**
 * Um texto da etiqueta que o operador guarda uma vez e reaproveita.
 *
 * Sao dois estados. Sem texto guardado, ou alterando, aparece o campo com
 * `Salvar`. Com texto guardado, aparece o texto, a caixa que decide se ele sai
 * na etiqueta, e `Alterar` e `Apagar`. A caixa existe para que tirar a linha da
 * etiqueta nao custe apagar o texto e digita-lo de novo depois.
 *
 * O que foi digitado so vale depois de `Salvar`: a previa e o arquivo impresso
 * leem o texto guardado, e nunca o rascunho do campo.
 *
 * A gravacao que falha — texto fora do contrato, armazenamento indisponivel —
 * mantem o campo aberto com o motivo escrito embaixo dele.
 */

function firstMessage(error) {
  return error?.issues?.[0]?.message ?? error?.message ?? 'Não foi possível guardar o texto.';
}

export default function SavedTextSetting({
  label,
  placeholder,
  maxLength,
  value,
  visible,
  visibilityLabel,
  onSave,
  onVisibleChange,
}) {
  const inputId = useId();
  const checkboxId = useId();
  const [editing, setEditing] = useState(value === '');
  const [draft, setDraft] = useState(value);
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

    if (run(() => onSave(draft))) {
      setEditing(draft.trim() === '');
    }
  }

  function handleEdit() {
    setDraft(value);
    setEditing(true);
  }

  function handleCancel() {
    setDraft(value);
    setError(null);
    setEditing(false);
  }

  function handleClear() {
    if (run(() => onSave(''))) {
      setDraft('');
      setEditing(true);
    }
  }

  if (editing) {
    const empty = draft.trim() === '';

    return (
      <form className="flex flex-col gap-2" onSubmit={handleSave} data-setting-state="editing">
        <Field
          id={inputId}
          label={label}
          hint={`${draft.trim().length}/${maxLength}`}
          error={error}
          optional
        >
          {(control) => (
            <TextInput
              {...control}
              focus="brand"
              value={draft}
              maxLength={maxLength}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              placeholder={placeholder}
              autoComplete="off"
            />
          )}
        </Field>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" className="flex-1" disabled={empty}>
            Salvar
          </Button>
          {value !== '' ? (
            <Button type="button" className="flex-1" onClick={handleCancel}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-setting-state="saved">
      <p className="text-rotulo font-semibold text-neutro-tinta">{label}</p>

      <p
        className="break-words border border-neutro-borda bg-neutro-papel px-3 py-2 text-sm text-neutro-tinta"
        data-setting-value=""
      >
        {value}
      </p>

      <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-2 text-sm text-neutro-tintaMedia">
        <input
          id={checkboxId}
          type="checkbox"
          checked={visible}
          onChange={(event) => run(() => onVisibleChange(event.target.checked))}
          className={cx(
            'h-[17px] w-[17px] shrink-0 cursor-pointer rounded accent-marca-vermelho',
            FOCUS_OUTLINE,
            FOCUS_OUTLINE_COLORS.brand,
          )}
        />
        {visibilityLabel}
      </label>

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
