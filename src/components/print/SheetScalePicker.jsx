import SegmentedControl from '../ui/SegmentedControl.jsx';

/**
 * Degraus de tamanho do desenho da folha.
 *
 * Aqui ha degrau abaixo de 1, ao contrario da previa da etiqueta: a folha serve
 * para conferir onde cada etiqueta fica, e nao se os modulos do simbolo saem
 * nitidos. Pela metade, as duas folhas A4 cabem inteiras na largura da pagina;
 * em tamanho real a area do desenho rola na horizontal.
 *
 * O fator so chega ao desenho como transformacao de um involucro ja
 * dimensionado; nenhuma medida em milimetro e multiplicada.
 */
export const SHEET_SCALE_STEPS = Object.freeze([0.5, 1]);
export const DEFAULT_SHEET_SCALE = 0.5;

function formatStep(step) {
  return `${String(step).replace('.', ',')}x`;
}

export default function SheetScalePicker({ value, onChange, className }) {
  const options = SHEET_SCALE_STEPS.map((step) => ({
    value: String(step),
    label: formatStep(step),
  }));

  return (
    <SegmentedControl
      legend="Tamanho da folha"
      name="escala-folha"
      options={options}
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
      className={className}
    />
  );
}
