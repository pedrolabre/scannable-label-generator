/**
 * Segunda guarda do texto, com a largura real da fonte.
 *
 * O corte do nome e decidido antes, por orcamento de caracteres, para que a
 * tela e o arquivo impresso quebrem o nome nos mesmos pontos. Esse orcamento
 * usa um avanco medio por caractere, que erra para mais em nome inteiro em
 * caixa alta: e o mesmo erro que a tela comete, e la o recorte da zona esconde
 * a sobra. No papel nao ha recorte, entao a sobra precisa ser cortada antes de
 * ser escrita, e e isso que esta funcao faz.
 *
 * A medicao chega de fora, como funcao, por dois motivos: a largura real
 * depende da fonte escolhida por quem desenha, e assim a regra continua
 * conferivel sem abrir documento nenhum.
 */

import { ELLIPSIS } from './labelText.js';

/**
 * Devolve o texto inteiro quando ele cabe, e o maior prefixo que cabe com
 * reticencias quando nao cabe. Devolve texto vazio quando nem as reticencias
 * cabem: escrever fora da zona seria pior do que nao escrever.
 */
export function trimToWidth(text, maxWidthMm, measure) {
  const value = typeof text === 'string' ? text : '';

  if (value.length === 0 || maxWidthMm <= 0) {
    return '';
  }

  if (measure(value) <= maxWidthMm) {
    return value;
  }

  if (measure(ELLIPSIS) > maxWidthMm) {
    return '';
  }

  let kept = value.length - 1;

  while (kept > 0) {
    const candidate = `${value.slice(0, kept).trimEnd()}${ELLIPSIS}`;

    if (measure(candidate) <= maxWidthMm) {
      return candidate;
    }

    kept -= 1;
  }

  return ELLIPSIS;
}
