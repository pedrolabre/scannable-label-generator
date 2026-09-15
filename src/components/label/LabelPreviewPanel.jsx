import { useState } from 'react';

import {
  DEFAULT_LABEL_LAYOUT_ID,
  findLabelLayout,
  getDefaultLabelLayout,
} from '../../domain/services/labelLayoutCatalog.js';

import Card from '../ui/Card.jsx';

import LabelLayoutPicker from './LabelLayoutPicker.jsx';
import LabelScalePicker, { DEFAULT_SCALE } from './LabelScalePicker.jsx';
import ProductLabel from './ProductLabel.jsx';

/**
 * Painel da previa de uma etiqueta: o modelo, a ampliacao e o desenho.
 *
 * O produto escolhido chega pronto de quem montou a tela, porque a escolha e
 * feita na listagem e precisa sobreviver a este componente. Ja o modelo e a
 * ampliacao sao estado local e comecam no padrao a cada abertura da pagina:
 * sao ajustes de quem esta olhando agora, e o modelo padrao e o que atende o
 * perfil real de produto.
 *
 * O aviso do cabecalho existe porque a tela nao e regua. O zoom do navegador
 * escala tudo, inclusive o milimetro do CSS, e a tela raramente tem a densidade
 * que a unidade pressupoe. Sem essa linha, quem imprimisse a tela em escala
 * cheia cobraria do aplicativo uma fidelidade que so o arquivo exportado
 * entrega.
 *
 * A etiqueta nao encolhe em janela estreita: o contrato visual proibe reflow, e
 * o modelo maior tem 100 mm de largura. Entao a area do desenho rola na
 * horizontal dentro do proprio painel, e o corpo da pagina continua parado.
 */

function PreviewPlaceholder({ state, children }) {
  return (
    <div
      data-preview-state={state}
      className="flex items-center justify-center rounded-[3px] border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
    >
      <p>{children}</p>
    </div>
  );
}

export default function LabelPreviewPanel({ product = null, hasProducts = false }) {
  const [layoutId, setLayoutId] = useState(DEFAULT_LABEL_LAYOUT_ID);
  const [scaleFactor, setScaleFactor] = useState(DEFAULT_SCALE);

  // O modelo escolhido sempre existe no catalogo, que e constante; o desvio
  // para o padrao cobre o dia em que um modelo sair da lista.
  const layout = findLabelLayout(layoutId) ?? getDefaultLabelLayout();

  function renderBody() {
    if (!hasProducts) {
      return (
        <PreviewPlaceholder state="empty-catalog">
          Cadastre um produto no formulário acima para ver a etiqueta dele.
        </PreviewPlaceholder>
      );
    }

    return (
      <>
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <LabelLayoutPicker value={layout.id} onChange={setLayoutId} />
          <LabelScalePicker value={scaleFactor} onChange={setScaleFactor} />
        </div>

        {product ? (
          <div data-preview-state="product" className="overflow-x-auto pb-1">
            <ProductLabel
              product={product}
              layout={layout}
              scaleFactor={scaleFactor}
              className="w-max"
            />
          </div>
        ) : (
          <PreviewPlaceholder state="no-selection">
            Escolha um produto na listagem para ver a etiqueta dele.
          </PreviewPlaceholder>
        )}
      </>
    );
  }

  return (
    <Card className="p-6" data-label-preview="">
      <div className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">Etiqueta do produto</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Prévia proporcional. O tamanho em tela varia com o zoom e com o monitor; a medida em
            milímetros vale na impressão.
          </p>
        </header>

        {renderBody()}
      </div>
    </Card>
  );
}
