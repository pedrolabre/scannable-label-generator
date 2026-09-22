import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import ModalShell from '../ui/ModalShell.jsx';
import ScrollRegion from '../ui/ScrollRegion.jsx';

import LabelScalePicker from './LabelScalePicker.jsx';
import ProductLabel from './ProductLabel.jsx';

/**
 * A mesma etiqueta da coluna da direita, com a janela inteira a disposicao.
 *
 * Ele nao redesenha nada: recebe o modelo e o degrau de ampliacao ja
 * resolvidos e chama o mesmo gerador. Um segundo desenho de etiqueta no projeto
 * seria um segundo lugar para o contrato visual divergir.
 *
 * A ampliacao trocada aqui e a mesma da coluna, e volta com o dialogo fechado:
 * quem ampliou para conferir os modulos do simbolo nao precisa refazer a
 * escolha ao voltar.
 *
 * Ele fecha no clique fora porque nao ha trabalho em andamento: o que se perde
 * e uma conferencia que recomeca com um clique.
 */
export default function LabelPreviewDialog({
  product,
  layout,
  scaleFactor,
  onScaleChange,
  onClose,
}) {
  return (
    <ModalShell
      title={product.displayName}
      subtitle={`${layout.name} · a medida em milímetros vale na impressão`}
      width={1160}
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <LabelScalePicker value={scaleFactor} onChange={onScaleChange} />

        <Card className="flex justify-center p-6">
          <ScrollRegion
            label="Desenho da etiqueta ampliada, rolagem horizontal"
            data-preview-state="enlarged"
            className="pb-1"
          >
            <ProductLabel
              product={product}
              layout={layout}
              scaleFactor={scaleFactor}
              className="w-max"
            />
          </ScrollRegion>
        </Card>
      </div>
    </ModalShell>
  );
}
