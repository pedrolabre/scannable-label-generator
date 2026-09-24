import { cx } from '../../lib/cx.js';

import { PEER_FOCUS_OUTLINE, PEER_FOCUS_OUTLINE_COLORS } from './focusClasses.js';

const OPTION_BASE = cx(
  'inline-flex h-11 cursor-pointer items-center justify-center rounded border px-3',
  'text-[13px] transition-colors',
  PEER_FOCUS_OUTLINE,
);

const OPTION_SELECTED = cx(
  'border-marca-vermelho bg-marca-vermelho font-semibold text-neutro-branco',
  PEER_FOCUS_OUTLINE_COLORS.brand,
);

const OPTION_IDLE = cx(
  'border-neutro-bordaForte bg-neutro-branco font-medium text-neutro-tintaMedia',
  'hover:bg-neutro-superficie',
  PEER_FOCUS_OUTLINE_COLORS.neutral,
);

/**
 * Escolha unica entre poucas opcoes, todas visiveis ao mesmo tempo.
 *
 * Por baixo sao botoes de radio de verdade, escondidos so visualmente: as setas
 * do teclado, o agrupamento por `name` e o anuncio em leitor de tela vem do
 * proprio navegador, e o realce de foco acompanha o radio em vez de ser
 * redesenhado a mao.
 *
 * As opcoes quebram em linha em vez de repartir a largura em partes iguais. Uma
 * faixa continua, com as opcoes divididas por um traco, seria o desenho certo
 * para rotulo curto; o catalogo de modelos usa o nome inteiro da etiqueta, com
 * a medida dentro — em coluna de 320 px, repartir a largura cortaria os tres
 * rotulos no meio. Enquanto o rotulo for o nome do modelo, quebrar e o unico
 * jeito de manter os tres legiveis.
 *
 * A altura de 44 px e o menor alvo de ponteiro aceitavel, e vale para todas as
 * opcoes, curtas ou longas.
 */
export default function SegmentedControl({ legend, name, options, value, onChange, className }) {
  return (
    <fieldset className={cx('min-w-0', className)}>
      <legend className="mb-2 text-[13px] font-semibold text-neutro-tinta">{legend}</legend>

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
