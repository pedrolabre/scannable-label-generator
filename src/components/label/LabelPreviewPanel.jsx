import { Maximize2 } from 'lucide-react';

import { findLabelLayout, getDefaultLabelLayout } from '../../domain/services/labelLayoutCatalog.js';

import ShellColumn from '../layout/ShellColumn.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import IconButton from '../ui/IconButton.jsx';
import ScrollRegion from '../ui/ScrollRegion.jsx';

import LabelLayoutPicker from './LabelLayoutPicker.jsx';
import LabelScalePicker, { DEFAULT_SCALE } from './LabelScalePicker.jsx';
import ProductLabel from './ProductLabel.jsx';

/**
 * Coluna da direita: o modelo, a ampliacao e o desenho da etiqueta escolhida.
 *
 * O produto escolhido chega pronto de quem montou a tela, porque a escolha e
 * feita na listagem e precisa sobreviver a este componente. O modelo e a
 * ampliacao tambem chegam de fora, pelo mesmo motivo: o dialogo da etiqueta
 * desenha com os dois, e quem monta a tela e quem abre o dialogo. Guardados
 * aqui, eles seriam dois valores — o da coluna e o do dialogo. Continuam
 * comecando no padrao a cada abertura da aplicacao: sao ajustes de quem esta
 * olhando agora, e o modelo padrao e o que atende o perfil real de produto.
 *
 * O aviso do corpo existe porque a tela nao e regua. O zoom do navegador escala
 * tudo, inclusive o milimetro do CSS, e a tela raramente tem a densidade que a
 * unidade pressupoe. Sem essa linha, quem imprimisse a tela em escala cheia
 * cobraria do aplicativo uma fidelidade que so o arquivo exportado entrega.
 *
 * A etiqueta nao encolhe em coluna estreita: o contrato visual proibe reflow, e
 * o modelo maior tem 100 mm de largura. Entao a area do desenho rola na
 * horizontal dentro do corpo da coluna. Essa rolagem e outra coisa que a da
 * coluna, e nao conta como uma segunda regiao vertical: ela tem nome e recebe
 * foco, para que o teclado tambem alcance a parte do desenho que esta fora da
 * vista.
 *
 * `Ampliar` pede o dialogo da etiqueta, onde o mesmo desenho tem a janela
 * inteira em vez da largura da coluna. Este componente pede e nao desenha: o dialogo e de
 * quem monta a tela, porque so ha um aberto por vez. A ampliacao e uma so: o
 * degrau escolhido aqui e o degrau que o dialogo abre.
 */

function PreviewPlaceholder({ state, children }) {
  return (
    <div
      data-preview-state={state}
      className="flex items-center justify-center rounded border border-dashed border-neutro-bordaForte px-6 py-10 text-center text-sm text-neutro-tintaFraca"
    >
      <p>{children}</p>
    </div>
  );
}

export default function LabelPreviewPanel({
  product = null,
  hasProducts = false,
  layoutId,
  onLayoutChange,
  scaleFactor = DEFAULT_SCALE,
  onScaleChange,
  onEnlarge,
  onEditProduct,
}) {
  // O modelo escolhido sempre existe no catalogo, que e constante; o desvio
  // para o padrao cobre o dia em que um modelo sair da lista.
  const layout = findLabelLayout(layoutId) ?? getDefaultLabelLayout();

  function renderBody() {
    if (!hasProducts) {
      return (
        <PreviewPlaceholder state="empty-catalog">
          Cadastre um produto para ver a etiqueta dele.
        </PreviewPlaceholder>
      );
    }

    return (
      <>
        <div className="flex flex-col gap-4">
          <LabelLayoutPicker value={layout.id} onChange={onLayoutChange} />
          <LabelScalePicker value={scaleFactor} onChange={onScaleChange} />
        </div>

        {product ? (
          <Card className="p-3">
            <ScrollRegion
              label="Desenho da etiqueta, rolagem horizontal"
              data-preview-state="product"
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
        ) : (
          <PreviewPlaceholder state="no-selection">
            Escolha um produto na listagem para ver a etiqueta dele.
          </PreviewPlaceholder>
        )}

        <p className="text-xs leading-relaxed text-neutro-tintaFraca">
          Prévia proporcional. O tamanho em tela varia com o zoom e com o monitor; a medida em
          milímetros vale na impressão.
        </p>
      </>
    );
  }

  return (
    <ShellColumn
      title="Prévia da etiqueta"
      className="border-l border-neutro-borda bg-neutro-branco"
      bodyClassName="flex flex-col gap-4 lg:gap-3"
      data-label-preview=""
      actions={
        product ? (
          <IconButton label="Ampliar prévia" onClick={onEnlarge}>
            <Maximize2 className="h-[15px] w-[15px]" aria-hidden="true" />
          </IconButton>
        ) : null
      }
      footer={
        product ? (
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              onClick={() => onEditProduct?.(product.id)}
            >
              Editar produto
            </Button>
            <Button type="button" className="flex-1" onClick={onEnlarge}>
              Ampliar
            </Button>
          </div>
        ) : null
      }
    >
      {renderBody()}
    </ShellColumn>
  );
}
