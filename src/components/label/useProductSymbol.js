import { useEffect, useState } from 'react';

import { describeProductSymbolSupport } from '../../domain/services/symbolContent.js';
import { generateSymbol } from '../../lib/barcode.js';
import { toBarcodeError } from '../../lib/barcodeError.js';

/**
 * Resolve o simbolo do primeiro exemplar de um produto, para quem desenha uma
 * etiqueta sozinha.
 *
 * A geracao e assincrona porque a biblioteca do simbolo so e carregada na
 * primeira chamada. O estado vive aqui, e nao dentro do desenho da etiqueta,
 * por dois motivos: o desenho continua sendo funcao do que recebe, e a corrida
 * fica num lugar so. Trocar de produto no meio de uma geracao nao pode pintar
 * o simbolo do produto anterior, e e o sinalizador de cancelamento que impede.
 *
 * O efeito depende do texto do simbolo, e nao do produto: editar o preco muda
 * o texto e gera de novo; editar a categoria, que nao entra no simbolo, nao.
 *
 * Quem desenha a folha nao usa este hook: la cada copia tem o proprio exemplar.
 */
export function useProductSymbol(product) {
  const content = describeProductSymbolSupport(product, 1);
  const text = content.text;
  const contentError = content.error;
  // A recusa e recriada a cada desenho; a frase dela e o que muda de fato.
  const contentMessage = contentError?.message ?? null;
  const [state, setState] = useState({ symbol: null, error: null, isLoading: true });

  useEffect(() => {
    let active = true;

    if (text === null) {
      setState({ symbol: null, error: toBarcodeError(contentError), isLoading: false });
      return undefined;
    }

    setState({ symbol: null, error: null, isLoading: true });

    generateSymbol(text)
      .then((symbol) => {
        if (active) {
          setState({ symbol, error: null, isLoading: false });
        }
      })
      .catch((error) => {
        if (active) {
          setState({ symbol: null, error, isLoading: false });
        }
      });

    return () => {
      active = false;
    };
  }, [text, contentMessage]);

  return state;
}
