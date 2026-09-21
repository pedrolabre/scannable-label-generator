import { cx } from '../../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from './focusClasses.js';

const BASE_CLASSES = cx(
  'inline-flex items-center justify-center gap-2 rounded-[3px] border px-4 py-2',
  'text-sm font-semibold shadow-none transition-colors',
  FOCUS_OUTLINE,
  'disabled:cursor-not-allowed disabled:opacity-60',
);

/**
 * `primary` carrega a cor de marca e fica reservada a acao principal de uma
 * tela. `secondary` e neutra e acompanha as acoes de apoio. `danger` marca a
 * acao que remove dados: fundo suave e texto vermelho, para se distinguir da
 * marca sem competir com ela.
 */
const VARIANT_CLASSES = {
  primary: cx(
    'border-[#cf1026] bg-[#cf1026] text-white',
    'hover:border-[#ad0b1d] hover:bg-[#ad0b1d]',
    FOCUS_OUTLINE_COLORS.brand,
  ),
  secondary: cx(
    'border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
    FOCUS_OUTLINE_COLORS.neutral,
    'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  ),
  danger: cx(
    'border-[#b93a20] bg-[#fff1ea] text-[#b93a20] hover:bg-[#ffe0d2]',
    FOCUS_OUTLINE_COLORS.danger,
    'dark:border-[#ffb8a7] dark:bg-[#3b211b] dark:text-[#ffb8a7] dark:hover:bg-[#4e2b22]',
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
