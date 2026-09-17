import { useEffect, useState } from 'react';

import { generateSymbol } from '../../lib/barcode.js';

/**
 * Resolve os simbolos de uma folha: um por codigo distinto, e nao um por
 * etiqueta. Todas as copias de um produto recebem o mesmo objeto congelado, e
 * o cache do gerador responde as folhas seguintes sem gerar de novo.
 *
 * Recebe so os codigos da folha que esta na tela. A tiragem inteira pode ter
 * centenas de codigos, e gerar todos para mostrar algumas dezenas de etiquetas
 * seria trabalho jogado fora.
 *
 * Devolve um mapa de codigo para `{ symbol, error }`. Codigo ausente do mapa
 * ainda esta sendo gerado, e a etiqueta mostra a caixa do simbolo reservada.
 * Resultado que chega depois de a folha mudar e descartado.
 */
export function useSheetSymbols(codes) {
  const key = JSON.stringify([...new Set(codes)].sort());
  const [resolved, setResolved] = useState(() => new Map());

  useEffect(() => {
    let active = true;
    const pending = JSON.parse(key);

    pending.forEach((code) => {
      generateSymbol(code)
        .then((symbol) => ({ symbol, error: null }))
        .catch((error) => ({ symbol: null, error }))
        .then((result) => {
          if (!active) {
            return;
          }

          setResolved((current) => {
            const previous = current.get(code);

            if (previous && previous.symbol === result.symbol && previous.error === result.error) {
              return current;
            }

            const next = new Map(current);
            next.set(code, result);
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
