import { cx } from '../../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from './focusClasses.js';

// Oito por oito ja passa do menor lado aceitavel para um alvo de ponteiro, e e
// por isso que este botao nao precisa de area extra como a caixa de marcacao.
const BASE_CLASSES = cx(
  'inline-flex h-8 w-8 items-center justify-center rounded-[2px]',
  'border border-transparent bg-transparent shadow-none transition-colors',
  FOCUS_OUTLINE,
  'disabled:cursor-not-allowed disabled:opacity-60',
);

/**
 * `plain` acompanha as acoes neutras de uma linha; `danger` marca a acao que
 * remove dados.
 */
const TONE_CLASSES = {
  plain: cx(
    'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
    FOCUS_OUTLINE_COLORS.neutral,
    'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  ),
  danger: cx(
    'text-[#b93a20] hover:bg-[#fff1ea]',
    FOCUS_OUTLINE_COLORS.danger,
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
