import { useEffect, useState } from 'react';

import { generateSymbol } from '../../lib/barcode.js';

/**
 * Resolve o simbolo de um produto para quem desenha uma etiqueta sozinha.
 *
 * A geracao e assincrona porque a biblioteca do simbolo so e carregada na
 * primeira chamada. O estado vive aqui, e nao dentro do desenho da etiqueta,
 * por dois motivos: o desenho continua sendo funcao do que recebe, e a corrida
 * fica num lugar so. Trocar de produto no meio de uma geracao nao pode pintar
 * o simbolo do produto anterior, e e o sinalizador de cancelamento que impede.
 *
 * Quem ja tem o simbolo em maos nao usa este hook: passa o simbolo direto para
 * o desenho. E o caso da folha de etiquetas, que gera uma vez por codigo
 * distinto e repete o mesmo desenho em todas as copias.
 */
export function useProductSymbol(product) {
  const systemCode = product?.systemCode;
  const [state, setState] = useState({ symbol: null, error: null, isLoading: true });

  useEffect(() => {
    let active = true;

    setState({ symbol: null, error: null, isLoading: true });

    generateSymbol(systemCode)
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
  }, [systemCode]);

  return state;
}
