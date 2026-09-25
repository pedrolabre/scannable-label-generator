import { useId } from 'react';

import { cx } from '../../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from '../ui/focusClasses.js';

/**
 * Caixa de marcacao com rotulo ao lado, das configuracoes da etiqueta: decide
 * se uma linha sai, ou como ela sai, sem apagar o que esta guardado.
 */
export default function SettingCheckbox({ label, checked, onChange }) {
  const id = useId();

  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-neutro-tintaMedia">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={cx(
          'h-[17px] w-[17px] shrink-0 cursor-pointer rounded accent-marca-vermelho',
          FOCUS_OUTLINE,
          FOCUS_OUTLINE_COLORS.brand,
        )}
      />
      {label}
    </label>
  );
}
