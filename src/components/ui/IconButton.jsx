import { cx } from '../../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from './focusClasses.js';

// O lado acompanha a altura de controle da tela: 44 px onde ela pode ser
// tocada, 32 px na tela larga, que e operada com mouse. Os dois passam do menor
// lado aceitavel para um alvo de ponteiro, e por isso este botao nao precisa de
// area extra como a caixa de marcacao.
//
// `inline` e o botao que mora dentro de um campo, como o de limpar a busca: ele
// precisa caber na altura do campo sem cobrir a borda dele.
const SIZE_CLASSES = {
  default: 'h-controle w-controle',
  inline: 'h-7 w-7',
};

const BASE_CLASSES = cx(
  'inline-flex flex-none items-center justify-center rounded',
  'border shadow-none transition-colors',
  FOCUS_OUTLINE,
  'disabled:cursor-not-allowed disabled:opacity-60',
);

/**
 * `plain` acompanha as acoes neutras de uma linha; `danger` marca a acao que
 * remove dados; `selected` marca o botao que esta ligado, como o do produto que
 * esta na previa. A cor nunca e o unico sinal: quem liga o tom tambem declara o
 * estado em `aria-pressed`.
 */
const TONE_CLASSES = {
  selected: cx(
    'border-marca-vermelhoBorda bg-marca-vermelhoTenue text-marca-vermelhoTexto',
    FOCUS_OUTLINE_COLORS.brand,
  ),
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
  size = 'default',
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
      className={cx(
        BASE_CLASSES,
        SIZE_CLASSES[size] ?? SIZE_CLASSES.default,
        TONE_CLASSES[tone] ?? TONE_CLASSES.plain,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
