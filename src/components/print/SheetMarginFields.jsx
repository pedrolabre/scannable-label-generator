import Field, { TextInput } from '../ui/Field.jsx';

import { MILLIMETER_STEP, SHEET_FIELDS } from './printInputs.js';

const STEP_HINT = `passo de ${String(MILLIMETER_STEP).replace('.', ',')} mm`;

const TWO_LINE_LABELS = new Set(['columnGapMm', 'rowGapMm']);

function renderLabel(field) {
  if (!TWO_LINE_LABELS.has(field.key)) {
    return field.label;
  }

  const [first, ...rest] = field.label.split(' ');

  return (
    <>
      {first} <span className="block">{rest.join(' ')}</span>
    </>
  );
}

/**
 * As quatro margens e os dois espacamentos da folha, em milimetros.
 *
 * Sao editaveis porque a borda nao imprimivel muda de impressora para
 * impressora: uma margem fixa que a impressora do operador nao honra inutiliza a
 * folha inteira. Trocar de modelo de folha repoe os seis numeros, e quem faz
 * isso e o store.
 *
 * O erro de cada campo chega pronto de quem montou a tela. Este componente nao
 * le numero nem valida: ele desenha o campo e devolve o texto digitado.
 *
 * A regra de largura e a da coluna, e nao a da janela, por consulta de
 * container: um por linha na coluna de 240 px, tres por linha quando a gaveta
 * abre (ou a coluna e a tela inteira). Os dois espacamentos quebram o rotulo
 * em duas linhas, e a linha da grade alinha os campos pela base.
 */
export default function SheetMarginFields({ values, errors = {}, onChange }) {
  return (
    <div className="[container-type:inline-size]">
      <div className="grid grid-cols-1 items-end gap-4 [@container(min-width:34rem)]:grid-cols-3">
        {SHEET_FIELDS.map((field) => (
          <Field
            key={field.key}
            id={`folha-${field.key}`}
            label={renderLabel(field)}
            hint={`mm · até ${field.max}`}
            error={errors[field.key]}
          >
            {(controlProps) => (
              <TextInput
                {...controlProps}
                inputMode="decimal"
                autoComplete="off"
                title={STEP_HINT}
                value={values[field.key] ?? ''}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}
          </Field>
        ))}
      </div>
    </div>
  );
}
