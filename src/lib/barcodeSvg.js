/**
 * Leitura e ajuste da string SVG do simbolo. Funcoes de texto puro: nao tocam
 * DOM, nao tocam canvas, e por isso rodam na suite sem ambiente grafico.
 *
 * O ajuste existe para que a proporcao 1:1 do simbolo sobreviva a quem o
 * posiciona. Sem `preserveAspectRatio` explicito e sem largura e altura fixas,
 * o simbolo escala para qualquer caixa sem nunca esticar.
 */

const ROOT_TAG = /<svg\b[^>]*>/;
const VIEW_BOX = /\bviewBox="([^"]*)"/;
const FIXED_WIDTH = /<svg\b[^>]*\swidth=/;
const FIXED_HEIGHT = /<svg\b[^>]*\sheight=/;

const ASPECT_ATTRIBUTES = ' preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges"';

export class BarcodeSvgError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BarcodeSvgError';
  }
}

/**
 * Devolve a caixa do simbolo em unidades de desenho. E daqui que sai a prova de
 * que o simbolo e quadrado, sem renderizar pixel nenhum.
 */
export function readSvgViewBox(svg) {
  const root = typeof svg === 'string' ? svg.match(ROOT_TAG) : null;

  if (!root) {
    throw new BarcodeSvgError('O simbolo gerado nao tem elemento raiz svg.');
  }

  const viewBox = root[0].match(VIEW_BOX);

  if (!viewBox) {
    throw new BarcodeSvgError('O simbolo gerado nao tem viewBox.');
  }

  const parts = viewBox[1].trim().split(/\s+/).map(Number);

  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    throw new BarcodeSvgError('O viewBox do simbolo gerado nao tem quatro numeros.');
  }

  return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
}

export function isSquareSvg(svg) {
  const viewBox = readSvgViewBox(svg);

  return viewBox.width === viewBox.height && viewBox.width > 0;
}

/**
 * Acrescenta ao elemento raiz as garantias de proporcao e recusa qualquer
 * largura ou altura fixa vinda da biblioteca: uma dimensao absoluta no simbolo
 * faria o layout herdar tamanho em pixel e abriria a porta para deformacao.
 */
export function normalizeSymbolSvg(svg) {
  const root = typeof svg === 'string' ? svg.match(ROOT_TAG) : null;

  if (!root) {
    throw new BarcodeSvgError('O simbolo gerado nao tem elemento raiz svg.');
  }

  if (FIXED_WIDTH.test(svg) || FIXED_HEIGHT.test(svg)) {
    throw new BarcodeSvgError('O simbolo gerado veio com largura ou altura fixa.');
  }

  const openingTag = root[0];
  const normalizedTag = `${openingTag.slice(0, -1)}${ASPECT_ATTRIBUTES}>`;

  return svg.replace(openingTag, normalizedTag);
}
