import { cx } from '../../lib/cx.js';

const OPTION_BASE = cx(
  'inline-flex cursor-pointer items-center justify-center rounded-[3px] border px-3 py-1.5',
  'text-xs font-semibold transition-colors',
  'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
);

const OPTION_SELECTED = cx(
  'border-[#cf1026] bg-[#cf1026] text-white',
  'peer-focus-visible:outline-[#cf1026]',
);

const OPTION_IDLE = cx(
  'border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
  'peer-focus-visible:outline-slate-400',
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
);

/**
 * Escolha unica entre poucas opcoes, todas visiveis ao mesmo tempo.
 *
 * Por baixo sao botoes de radio de verdade, escondidos so visualmente: as setas
 * do teclado, o agrupamento por `name` e o anuncio em leitor de tela vem do
 * proprio navegador, e o realce de foco acompanha o radio em vez de ser
 * redesenhado a mao. Em largura curta as opcoes quebram em linha em vez de
 * encolher o texto.
 *
 * Serve a lista curta. Quando o conjunto crescer a ponto de nao caber em duas
 * linhas, o lugar da troca por um campo de selecao e aqui dentro.
 */
export default function SegmentedControl({ legend, name, options, value, onChange, className }) {
  return (
    <fieldset className={cx('min-w-0', className)}>
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {legend}
      </legend>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <label key={option.value} className="min-w-0">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span className={cx(OPTION_BASE, isSelected ? OPTION_SELECTED : OPTION_IDLE)}>
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
