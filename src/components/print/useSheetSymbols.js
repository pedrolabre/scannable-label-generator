import { useEffect, useState } from 'react';

import { generateSymbol } from '../../lib/barcode.js';

/**
 * Resolve os simbolos de uma folha: um por exemplar, porque cada copia grava o
 * proprio numero. O cache do gerador responde a folha ja vista sem gerar de
 * novo.
 *
 * Recebe so os textos da folha que esta na tela. A tiragem inteira pode ter
 * milhares de etiquetas, e gerar todas para mostrar algumas dezenas seria
 * trabalho jogado fora.
 *
 * Devolve um mapa de texto para `{ symbol, error }`. Texto ausente do mapa
 * ainda esta sendo gerado, e a etiqueta mostra a caixa do simbolo reservada.
 * Resultado que chega depois de a folha mudar e descartado.
 */
export function useSheetSymbols(texts) {
  const key = JSON.stringify([...new Set(texts)].sort());
  const [resolved, setResolved] = useState(() => new Map());

  useEffect(() => {
    let active = true;
    const pending = JSON.parse(key);

    pending.forEach((text) => {
      generateSymbol(text)
        .then((symbol) => ({ symbol, error: null }))
        .catch((error) => ({ symbol: null, error }))
        .then((result) => {
          if (!active) {
            return;
          }

          setResolved((current) => {
            const previous = current.get(text);

            if (previous && previous.symbol === result.symbol && previous.error === result.error) {
              return current;
            }

            const next = new Map(current);
            next.set(text, result);
            return next;
          });
        });
    });

    return () => {
      active = false;
    };
  }, [key]);

  return resolved;
}
