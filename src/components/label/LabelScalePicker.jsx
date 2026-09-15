import SegmentedControl from '../ui/SegmentedControl.jsx';

/**
 * Degraus de ampliacao da previa.
 *
 * Nao ha degrau abaixo de 1: encolher a etiqueta faria o simbolo parecer pior
 * do que sai impresso, e a tela passaria a dar uma impressao errada sobre
 * legibilidade. A ampliacao serve ao que a tela nao mostra de outro jeito, que
 * e se os modulos do simbolo saem nitidos.
 *
 * O fator so chega ao desenho como transformacao de um involucro ja
 * dimensionado; a medida em milimetro da etiqueta nunca e multiplicada.
 */
export const SCALE_STEPS = Object.freeze([1, 1.5, 2]);
export const DEFAULT_SCALE = 1;

function formatStep(step) {
  return `${String(step).replace('.', ',')}x`;
}

export default function LabelScalePicker({ value, onChange, className }) {
  const options = SCALE_STEPS.map((step) => ({
    value: String(step),
    label: formatStep(step),
  }));

  return (
    <SegmentedControl
      legend="Ampliação"
      name="ampliacao-etiqueta"
      options={options}
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
      className={className}
    />
  );
}
