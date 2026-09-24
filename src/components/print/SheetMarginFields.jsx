import Field, { TextInput } from '../ui/Field.jsx';

import { MILLIMETER_STEP, SHEET_FIELDS } from './printInputs.js';

const STEP_HINT = `passo de ${String(MILLIMETER_STEP).replace('.', ',')} mm`;

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
 * Sao seis campos de rotulo longo com uma dica ao lado, e eles vivem numa
 * coluna de 320 px. A regra de largura e a da coluna, e nao a da janela: tres
 * ou dois por linha cabiam na tela larga e transbordavam a coluna, que passava
 * a rolar de lado. Um por linha e o unico arranjo em que o rotulo e a dica nao
 * brigam pela mesma linha nessa largura.
 */
export default function SheetMarginFields({ values, errors = {}, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {SHEET_FIELDS.map((field) => (
        <Field
          key={field.key}
          id={`folha-${field.key}`}
          label={field.label}
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
  );
}
