import { useId, useState } from 'react';

import {
  INSTALLMENT_COUNT_MAX,
  INSTALLMENT_COUNT_MIN,
  INTEREST_MODES,
  formatInterestRate,
  parseInstallmentCount,
  parseInterestRate,
} from '../../domain/services/installmentPlan.js';

import Button from '../ui/Button.jsx';
import Field, { TextInput } from '../ui/Field.jsx';
import SegmentedControl from '../ui/SegmentedControl.jsx';

import SettingCheckbox from './SettingCheckbox.jsx';

/**
 * Crediario da loja: taxa de juros ao mes, jeito de calcular a parcela e
 * quantidade de parcelas, guardados uma vez para todos os produtos.
 *
 * A taxa sai sempre na etiqueta. O calculo decide se a parcela sai junto:
 * com `Nenhum`, a etiqueta leva so a taxa, e o campo de parcelas nem aparece;
 * com juros simples ou compostos, a parcela e calculada com o preco de cada
 * produto.
 *
 * Mesmo desenho dos textos da etiqueta. Sem crediario guardado, ou alterando,
 * aparece o formulario com `Salvar`. Com crediario guardado, aparece o resumo,
 * a caixa do arredondamento da parcela para ,90 e `Alterar` e `Apagar`. O que
 * foi digitado so vale depois de `Salvar`, e so dentro dos limites: fora deles
 * o campo continua aberto com o motivo escrito embaixo, e nada e gravado. A
 * gravacao que falha no armazenamento tambem aparece aqui.
 */

const INTEREST_OPTIONS = [
  { value: INTEREST_MODES.NONE, label: 'Nenhum' },
  { value: INTEREST_MODES.SIMPLE, label: 'Simples' },
  { value: INTEREST_MODES.COMPOUND, label: 'Compostos' },
];

const INTEREST_SUMMARY = {
  [INTEREST_MODES.SIMPLE]: 'juros simples',
  [INTEREST_MODES.COMPOUND]: 'juros compostos',
};

function firstMessage(error) {
  return error?.issues?.[0]?.message ?? error?.message ?? 'Não foi possível guardar o crediário.';
}

export function describeCreditSummary(settings) {
  const rate = `${formatInterestRate(settings.creditRateHundredths)} a.m.`;

  if (settings.creditInterest === INTEREST_MODES.NONE) {
    return `${rate} · sem cálculo da parcela`;
  }

  return [`${settings.creditInstallments}x`, INTEREST_SUMMARY[settings.creditInterest], rate].join(' · ');
}

function draftFrom(settings) {
  return {
    rate: Number.isInteger(settings.creditRateHundredths)
      ? formatInterestRate(settings.creditRateHundredths).replace('%', '')
      : '',
    interest: settings.creditInterest,
    installments: Number.isInteger(settings.creditInstallments) ? String(settings.creditInstallments) : '',
  };
}

export default function LabelCreditSetting({ settings, onSave, onChange }) {
  const rateId = useId();
  const countId = useId();
  const interestName = useId();
  const saved = Number.isInteger(settings.creditRateHundredths);
  const calculates = settings.creditInterest !== INTEREST_MODES.NONE;
  const [editing, setEditing] = useState(!saved);
  const [draft, setDraft] = useState(() => draftFrom(settings));
  const [errors, setErrors] = useState({});

  function run(action) {
    try {
      action();
      setErrors({});
      return true;
    } catch (failure) {
      setErrors({ general: firstMessage(failure) });
      return false;
    }
  }

  function change(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors({});
  }

  function handleSave(event) {
    event.preventDefault();

    const found = {};
    let rate = null;
    let installments = null;

    try {
      rate = parseInterestRate(draft.rate);
    } catch (failure) {
      found.rate = failure.message;
    }

    if (draft.interest !== INTEREST_MODES.NONE) {
      try {
        installments = parseInstallmentCount(draft.installments);
      } catch (failure) {
        found.installments = failure.message;
      }
    }

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    const stored = run(() =>
      onSave({
        creditRateHundredths: rate,
        creditInterest: draft.interest,
        creditInstallments: installments,
      }),
    );

    if (stored) {
      setEditing(false);
    }
  }

  function handleEdit() {
    setDraft(draftFrom(settings));
    setErrors({});
    setEditing(true);
  }

  function handleCancel() {
    setDraft(draftFrom(settings));
    setErrors({});
    setEditing(false);
  }

  function handleClear() {
    if (run(() => onSave(null))) {
      setDraft(draftFrom({ ...settings, creditRateHundredths: null, creditInstallments: null }));
      setEditing(true);
    }
  }

  if (editing) {
    return (
      <form className="flex flex-col gap-3" onSubmit={handleSave} data-credit-state="editing" noValidate>
        <p className="text-rotulo font-semibold text-neutro-tinta">
          Crediário
          <span className="ml-1.5 font-normal text-neutro-tintaFraca">opcional</span>
        </p>

        <Field id={rateId} label="Taxa de juros ao mês (%)" hint="0 a 20" error={errors.rate}>
          {(control) => (
            <TextInput
              {...control}
              focus="brand"
              inputMode="decimal"
              value={draft.rate}
              onChange={(event) => change('rate', event.target.value)}
              placeholder="Ex.: 8 ou 2,5"
              autoComplete="off"
              data-credit-field="rate"
            />
          )}
        </Field>

        <SegmentedControl
          legend="Cálculo da parcela"
          name={interestName}
          options={INTEREST_OPTIONS}
          value={draft.interest}
          onChange={(interest) => change('interest', interest)}
          stretch
        />

        {draft.interest !== INTEREST_MODES.NONE ? (
          <Field
            id={countId}
            label="Parcelas"
            hint={`${INSTALLMENT_COUNT_MIN} a ${INSTALLMENT_COUNT_MAX}`}
            error={errors.installments}
          >
            {(control) => (
              <TextInput
                {...control}
                focus="brand"
                inputMode="numeric"
                value={draft.installments}
                onChange={(event) => change('installments', event.target.value)}
                placeholder="Ex.: 10"
                autoComplete="off"
                data-credit-field="installments"
              />
            )}
          </Field>
        ) : null}

        {errors.general ? <p className="text-xs text-marca-vermelhoTexto">{errors.general}</p> : null}

        <div className="flex gap-2">
          <Button type="submit" variant="primary" className="flex-1" disabled={draft.rate.trim() === ''}>
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
    <div className="flex flex-col gap-2" data-credit-state="saved">
      <p className="text-rotulo font-semibold text-neutro-tinta">Crediário</p>

      <p
        className="break-words border border-neutro-borda bg-neutro-papel px-3 py-2 text-sm text-neutro-tinta"
        data-credit-summary=""
      >
        {describeCreditSummary(settings)}
      </p>

      {calculates ? (
        <SettingCheckbox
          label="Arredondar a parcela para ,90"
          checked={settings.creditRoundToNinety}
          onChange={(creditRoundToNinety) => run(() => onChange({ creditRoundToNinety }))}
        />
      ) : null}

      <p className="text-xs text-neutro-tintaFraca">Sai na etiqueta de 10 por folha e na tag grande.</p>

      {errors.general ? <p className="text-xs text-marca-vermelhoTexto">{errors.general}</p> : null}

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
