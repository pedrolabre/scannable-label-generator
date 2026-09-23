import { cx } from '../../lib/cx.js';

const CONTROL_BASE_CLASSES = cx(
  'w-full rounded border px-3 text-sm shadow-none outline-none transition-colors',
  'border-neutro-bordaForte bg-neutro-branco text-neutro-tinta',
  'placeholder:text-neutro-tintaFraca focus-visible:ring-2',
);

/**
 * Cor de foco por tipo de campo, no mesmo codigo semantico usado no restante da
 * interface: marca para o texto que sai impresso, aviso para os codigos que
 * alimentam a leitura por maquina, confirmacao para valores de venda.
 */
const FOCUS_CLASSES = {
  neutral: 'focus-visible:border-neutro-tintaFraca focus-visible:ring-neutro-superficie',
  brand: 'focus-visible:border-marca-vermelho focus-visible:ring-marca-vermelhoTenue',
  code: 'focus-visible:border-marca-amareloTexto focus-visible:ring-marca-amareloTenue',
  price: 'focus-visible:border-marca-verde focus-visible:ring-marca-verdeTenue',
};

const INVALID_CLASSES = cx(
  'border-marca-vermelhoTexto',
  'focus-visible:border-marca-vermelhoTexto focus-visible:ring-marca-vermelhoTenue',
);

function controlClasses({ focus, invalid, className }) {
  return cx(
    CONTROL_BASE_CLASSES,
    FOCUS_CLASSES[focus] ?? FOCUS_CLASSES.neutral,
    invalid && INVALID_CLASSES,
    className,
  );
}

export function TextInput({ focus = 'neutral', invalid = false, className, ...rest }) {
  return (
    <input
      type="text"
      aria-invalid={invalid || undefined}
      className={cx(controlClasses({ focus, invalid, className }), 'h-controle')}
      {...rest}
    />
  );
}

export function Textarea({ focus = 'neutral', invalid = false, rows = 3, className, ...rest }) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cx(controlClasses({ focus, invalid, className }), 'resize-y py-2.5')}
      {...rest}
    />
  );
}

/**
 * Rotulo, controle e mensagens de um campo. O controle chega por funcao e
 * recebe de volta `id`, `aria-describedby` e `invalid` ja resolvidos, entao o
 * vinculo de acessibilidade fica descrito num lugar so.
 */
export default function Field({ id, label, error, hint, optional = false, children }) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = cx(errorId, hintId);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-2 text-rotulo font-semibold text-neutro-tinta"
      >
        <span>
          {label}
          {optional ? (
            <span className="ml-1.5 font-normal text-neutro-tintaFraca">opcional</span>
          ) : null}
        </span>
        {hint ? (
          <span id={hintId} className="font-normal tabular-nums text-neutro-tintaFraca">
            {hint}
          </span>
        ) : null}
      </label>

      {children({
        id,
        invalid: Boolean(error),
        'aria-describedby': describedBy || undefined,
      })}

      {error ? (
        <p id={errorId} className="text-xs text-marca-vermelhoTexto">
          {error}
        </p>
      ) : null}
    </div>
  );
}
