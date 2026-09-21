import { cx } from '../../lib/cx.js';

// O texto de marcador do campo e texto como qualquer outro, e o tom 400 sobre
// branco fica em 2,56 para 1 — bem abaixo do minimo. O tom 500 resolve os dois
// temas: 4,76 sobre o fundo claro e 6,96 no escuro, invertendo os tons.
const CONTROL_BASE_CLASSES = cx(
  'w-full rounded-[3px] border px-3 py-2 text-sm shadow-none outline-none transition-colors',
  'border-slate-300 bg-white text-slate-900 placeholder:text-slate-500',
  'focus-visible:ring-2',
  'dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400',
);

/**
 * Cor de foco por tipo de campo, no mesmo codigo semantico usado no restante da
 * interface: marca para o texto que sai impresso, ambar para os codigos que
 * alimentam a leitura por maquina, verde para valores de venda.
 */
const FOCUS_CLASSES = {
  neutral: cx(
    'focus-visible:border-slate-400 focus-visible:ring-slate-300/60',
    'dark:focus-visible:border-slate-500',
  ),
  brand: 'focus-visible:border-[#cf1026] focus-visible:ring-[#cf1026]/25',
  code: cx(
    'focus-visible:border-[#8a5a00] focus-visible:ring-[#8a5a00]/25',
    'dark:focus-visible:border-[#f4c95f]',
  ),
  price: 'focus-visible:border-[#159447] focus-visible:ring-[#159447]/25',
};

const INVALID_CLASSES = cx(
  'border-[#b93a20]',
  'focus-visible:border-[#b93a20] focus-visible:ring-[#b93a20]/25',
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
      className={controlClasses({ focus, invalid, className })}
      {...rest}
    />
  );
}

export function Textarea({ focus = 'neutral', invalid = false, rows = 3, className, ...rest }) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cx(controlClasses({ focus, invalid, className }), 'resize-y')}
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
        className="flex items-baseline justify-between gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
      >
        <span>
          {label}
          {optional ? (
            <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">opcional</span>
          ) : null}
        </span>
        {hint ? (
          <span
            id={hintId}
            className="font-normal tabular-nums text-slate-500 dark:text-slate-400"
          >
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
        <p id={errorId} className="text-xs text-[#b93a20] dark:text-[#ffb8a7]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
