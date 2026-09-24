import { cx } from '../../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from './focusClasses.js';

// Trinta e dois por trinta e dois ja passa do menor lado aceitavel para um alvo
// de ponteiro, e e por isso que este botao nao precisa de area extra como a
// caixa de marcacao.
const BASE_CLASSES = cx(
  'inline-flex h-8 w-8 items-center justify-center rounded',
  'border shadow-none transition-colors',
  FOCUS_OUTLINE,
  'disabled:cursor-not-allowed disabled:opacity-60',
);

/**
 * `plain` acompanha as acoes neutras de uma linha; `danger` marca a acao que
 * remove dados.
 */
const TONE_CLASSES = {
  plain: cx(
    'border-neutro-bordaForte bg-neutro-branco text-neutro-tintaMedia hover:bg-neutro-superficie',
    FOCUS_OUTLINE_COLORS.neutral,
  ),
  danger: cx(
    'border-neutro-bordaForte bg-neutro-branco text-marca-vermelhoTexto',
    'hover:border-marca-vermelhoBorda hover:bg-marca-vermelhoTenue',
    FOCUS_OUTLINE_COLORS.danger,
  ),
};

/**
 * Botao compacto sem rotulo visivel, para as acoes que se repetem a cada item
 * de uma lista e para o fechar dos dialogos. `label` e obrigatorio: e ele que
 * nomeia o botao para leitores de tela e alimenta a dica do ponteiro.
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
