import { listLabelLayouts } from '../../domain/services/labelLayoutCatalog.js';

import SegmentedControl from '../ui/SegmentedControl.jsx';

/**
 * Escolha do modelo de etiqueta.
 *
 * O catalogo e constante de codigo e esta pronto antes de qualquer leitura de
 * armazenamento, entao aqui nao ha carregamento para tratar nem falha de
 * leitura para exibir: o componente le a lista e desenha.
 *
 * O rotulo de cada opcao e o proprio nome do modelo, que ja carrega a medida
 * ("Tag grande (100 x 70 mm)"). Repetir a medida ao lado imprimiria o mesmo
 * numero duas vezes.
 */
export default function LabelLayoutPicker({ value, onChange, className }) {
  const options = listLabelLayouts().map((layout) => ({
    value: layout.id,
    label: layout.name,
  }));

  return (
    <SegmentedControl
      legend="Modelo"
      name="modelo-etiqueta"
      options={options}
      value={value}
      onChange={onChange}
      className={className}
    />
  );
}
