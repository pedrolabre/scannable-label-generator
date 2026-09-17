/**
 * Leitura do contorno do simbolo a partir da string SVG do gerador.
 *
 * O gerador devolve o desenho pronto: uma caixa quadrada em unidades de
 * desenho e um unico caminho feito so de `M`, `L` e `Z`. Aqui esse caminho e
 * lido de volta como lista de subcaminhos fechados, na mesma unidade em que foi
 * escrito, para que quem desenha em outro meio o reproduza ponto a ponto.
 *
 * Duas consequencias do formato que este modulo preserva:
 *
 * - Os buracos dos padroes de localizacao sao desenhados no sentido contrario
 *   ao do contorno que os cerca. Quem preenche precisa usar a regra nao nula,
 *   senao o quadrado interno do padrao some e o simbolo deixa de ser lido.
 * - A ordem dos pontos e a ordem original. Inverter um subcaminho inverteria o
 *   sentido dele e trocaria buraco por area cheia.
 *
 * Texto puro: nao toca DOM, nao renderiza, e roda na suite sem ambiente
 * grafico.
 */

import { readSvgViewBox } from './barcodeSvg.js';

const PATH_DATA = /<path\b[^>]*\sd="([^"]*)"/;
const COMMAND = /([MLZ])([^MLZ]*)/g;

export class SymbolPathError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SymbolPathError';
  }
}

function readNumbers(chunk) {
  const parts = chunk.trim().split(/[\s,]+/).filter(Boolean).map(Number);

  if (parts.length !== 2 || parts.some((value) => !Number.isFinite(value))) {
    throw new SymbolPathError('O caminho do simbolo tem um comando sem par de coordenadas.');
  }

  return { x: parts[0], y: parts[1] };
}

/**
 * Devolve `{ sideUnits, subpaths }`, onde `sideUnits` e o lado da caixa em
 * unidades de desenho e cada subcaminho e uma lista de pontos fechada de forma
 * implicita, como o `Z` do original.
 */
export function readSymbolPath(svg) {
  const viewBox = readSvgViewBox(svg);

  if (viewBox.width !== viewBox.height || viewBox.width <= 0) {
    throw new SymbolPathError('A caixa do simbolo nao e quadrada.');
  }

  const match = typeof svg === 'string' ? svg.match(PATH_DATA) : null;

  if (!match) {
    throw new SymbolPathError('O simbolo gerado nao tem caminho de desenho.');
  }

  const subpaths = [];
  let current = null;

  COMMAND.lastIndex = 0;

  let command = COMMAND.exec(match[1]);

  while (command !== null) {
    const [, letter, chunk] = command;

    if (letter === 'Z') {
      if (current === null || current.length < 3) {
        throw new SymbolPathError('O caminho do simbolo fecha um subcaminho sem area.');
      }

      subpaths.push(Object.freeze(current));
      current = null;
    } else if (letter === 'M') {
      if (current !== null) {
        throw new SymbolPathError('O caminho do simbolo comeca um subcaminho sem fechar o anterior.');
      }

      current = [readNumbers(chunk)];
    } else {
      if (current === null) {
        throw new SymbolPathError('O caminho do simbolo tem segmento antes do ponto inicial.');
      }

      current.push(readNumbers(chunk));
    }

    command = COMMAND.exec(match[1]);
  }

  if (current !== null) {
    throw new SymbolPathError('O caminho do simbolo termina com um subcaminho aberto.');
  }

  if (subpaths.length === 0) {
    throw new SymbolPathError('O caminho do simbolo nao tem nenhum subcaminho.');
  }

  return Object.freeze({ sideUnits: viewBox.width, subpaths: Object.freeze(subpaths) });
}

/**
 * Traduz o caminho para uma caixa de `sizeMm` de lado, ancorada em
 * (`xMm`, `yMm`). A escala e a mesma nos dois eixos por construcao, entao o
 * simbolo nao tem como sair esticado.
 */
export function scaleSymbolPath({ sideUnits, subpaths }, { xMm, yMm, sizeMm }) {
  const factor = sizeMm / sideUnits;

  return subpaths.map((points) =>
    points.map((point) => ({ xMm: xMm + point.x * factor, yMm: yMm + point.y * factor })),
  );
}
