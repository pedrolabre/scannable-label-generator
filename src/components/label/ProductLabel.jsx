import { describeBarcodeError } from '../../lib/barcodeError.js';
import InlineAlert from '../ui/InlineAlert.jsx';

import LabelSurface from './LabelSurface.jsx';
import { useProductSymbol } from './useProductSymbol.js';

/**
 * Etiqueta de um produto, com o simbolo resolvido aqui dentro.
 *
 * A etiqueta com simbolo recusado continua desenhando nome, preco e codigo: a
 * tela e onde o operador descobre qual produto falhou, e apagar tudo esconderia
 * justamente essa informacao. Dentro da caixa do simbolo fica so um marcador
 * curto; o motivo escrito sai fora da etiqueta, porque uma frase inteira nao
 * cabe numa caixa de duas dezenas de milimetros e nao pertence ao objeto
 * impresso.
 */
export default function ProductLabel({ product, layout, scaleFactor = 1, className }) {
  const { symbol, error } = useProductSymbol(product);

  return (
    <div className={className}>
      <LabelSurface
        product={product}
        layout={layout}
        symbol={symbol}
        symbolError={error}
        scaleFactor={scaleFactor}
      />

      {error ? <InlineAlert className="mt-3">{describeBarcodeError(error)}</InlineAlert> : null}
    </div>
  );
}
