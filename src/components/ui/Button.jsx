import { cx } from '../../lib/cx.js';

const BASE_CLASSES = cx(
  'inline-flex items-center justify-center gap-2 rounded-[3px] border px-4 py-2',
  'text-sm font-semibold shadow-none transition-colors',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-60',
);

/**
 * `primary` carrega a cor de marca e fica reservada a acao principal de uma
 * tela. `secondary` e neutra e acompanha as acoes de apoio.
 */
const VARIANT_CLASSES = {
  primary: cx(
    'border-[#cf1026] bg-[#cf1026] text-white',
    'hover:border-[#ad0b1d] hover:bg-[#ad0b1d]',
    'focus-visible:outline-[#cf1026]',
  ),
  secondary: cx(
    'border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
    'focus-visible:outline-slate-400',
    'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  ),
};

export default function Button({
  type = 'button',
  variant = 'secondary',
  className,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cx(BASE_CLASSES, VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.secondary, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
