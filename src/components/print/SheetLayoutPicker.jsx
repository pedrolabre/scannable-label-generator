import { listSheetLayouts } from '../../domain/services/sheetLayoutCatalog.js';

import SegmentedControl from '../ui/SegmentedControl.jsx';

/**
 * Escolha do modelo de folha.
 *
 * O catalogo e constante de codigo e esta pronto antes de qualquer leitura de
 * armazenamento, entao aqui nao ha carregamento para tratar nem falha de leitura
 * para exibir: o componente le a lista e desenha.
 *
 * O rotulo de cada opcao e o proprio nome do modelo, que ja carrega a medida
 * ("A4 retrato (210 x 297 mm)"). Repetir a medida ao lado imprimiria o mesmo
 * numero duas vezes.
 */
export default function SheetLayoutPicker({ value, onChange, className }) {
  const options = listSheetLayouts().map((layout) => ({
    value: layout.id,
    label: layout.name,
  }));

  return (
    <SegmentedControl
      legend="Folha"
      name="modelo-folha"
      options={options}
      value={value}
      onChange={onChange}
      className={className}
    />
  );
}
