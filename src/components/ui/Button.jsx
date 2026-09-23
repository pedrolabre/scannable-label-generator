import { cx } from '../../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from './focusClasses.js';

const BASE_CLASSES = cx(
  'inline-flex items-center justify-center gap-2 rounded border px-4 text-sm lg:px-3',
  'h-controle font-semibold shadow-none transition-colors',
  FOCUS_OUTLINE,
  'disabled:cursor-not-allowed disabled:opacity-60',
);

/**
 * `primary` carrega a cor de marca e fica reservada a acao principal de uma
 * tela. `secondary` e neutra e acompanha as acoes de apoio. `danger` marca a
 * acao que remove dados.
 *
 * As tres variantes dividem o mesmo vermelho, e o que as separa e o peso: a
 * marca preenche, o perigo usa fundo tenue com texto proprio. Nenhum texto de
 * erro cai sobre preenchimento vermelho.
 */
const VARIANT_CLASSES = {
  primary: cx(
    'border-marca-vermelho bg-marca-vermelho text-neutro-branco',
    'hover:border-marca-vermelhoEscuro hover:bg-marca-vermelhoEscuro',
    FOCUS_OUTLINE_COLORS.brand,
  ),
  secondary: cx(
    'border-neutro-bordaForte bg-neutro-branco text-neutro-tinta hover:bg-neutro-superficie',
    'font-medium',
    FOCUS_OUTLINE_COLORS.neutral,
  ),
  danger: cx(
    'border-marca-vermelhoBorda bg-marca-vermelhoTenue text-marca-vermelhoTexto',
    'hover:border-marca-vermelhoTexto',
    FOCUS_OUTLINE_COLORS.danger,
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
