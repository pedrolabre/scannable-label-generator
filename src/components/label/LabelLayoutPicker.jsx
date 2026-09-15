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
 *
 * `name` e `legend` tem padrao porque a tela da previa e a primeira chamadora e
 * nao precisa declarar nenhum dos dois. Uma segunda escolha de modelo na mesma
 * pagina precisa: o agrupamento dos botoes de radio e feito por `name`, entao
 * dois grupos com o mesmo nome se moveriam juntos, e dois titulos iguais nao
 * diriam qual deles governa o que sai impresso.
 */
export default function LabelLayoutPicker({
  value,
  onChange,
  legend = 'Modelo',
  name = 'modelo-etiqueta',
  className,
}) {
  const options = listLabelLayouts().map((layout) => ({
    value: layout.id,
    label: layout.name,
  }));

  return (
    <SegmentedControl
      legend={legend}
      name={name}
      options={options}
      value={value}
      onChange={onChange}
      className={className}
    />
  );
}
