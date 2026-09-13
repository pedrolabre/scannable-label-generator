import { cx } from '../../lib/cx.js';

const BASE_CLASSES = cx(
  'inline-flex h-8 w-8 items-center justify-center rounded-[2px]',
  'border border-transparent bg-transparent shadow-none transition-colors',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-60',
);

/**
 * `plain` acompanha as acoes neutras de uma linha; `danger` marca a acao que
 * remove dados.
 */
const TONE_CLASSES = {
  plain: cx(
    'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
    'focus-visible:outline-slate-400',
    'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  ),
  danger: cx(
    'text-[#b93a20] hover:bg-[#fff1ea]',
    'focus-visible:outline-[#b93a20]',
    'dark:text-[#ffb8a7] dark:hover:bg-[#3b211b]',
  ),
};

/**
 * Botao compacto sem rotulo visivel, para as acoes que se repetem a cada item
 * de uma lista. `label` e obrigatorio: e ele que nomeia o botao para leitores
 * de tela e alimenta a dica do ponteiro.
 */
export default function IconButton({
  label,
  tone = 'plain',
  type = 'button',
  className,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(BASE_CLASSES, TONE_CLASSES[tone] ?? TONE_CLASSES.plain, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
