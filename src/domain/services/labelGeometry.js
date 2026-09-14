/**
 * Calculo das zonas fixas da etiqueta, em milimetros reais.
 *
 * Tudo aqui e funcao pura: nao toca DOM, nao renderiza, nao conhece React e
 * nao depende do conteudo do produto. As zonas saem das medidas do modelo, e
 * so delas, e e por isso que nenhum texto longo demais pode empurrar outro
 * elemento nem redimensionar a etiqueta.
 *
 * O desenho e o da secao 8.1 da especificacao: nome na largura inteira do
 * topo, simbolo ancorado no canto inferior direito, e uma coluna a esquerda do
 * simbolo com o preco no alto e o codigo numerico rente a base.
 *
 *   x cresce para a direita, y cresce para baixo, origem no canto superior
 *   esquerdo da etiqueta.
 *
 * As proporcoes sao constantes do modulo, e nao numeros por modelo. Um modelo
 * novo entra no catalogo declarando largura, altura, margem e lado do simbolo:
 * todo o resto e derivado, e os mesmos testes que protegem os modelos de hoje
 * passam a proteger o novo. O preco dessa escolha e que ajustar a aparencia de
 * um modelo significa mexer numa constante que vale para todos.
 */

import { BARCODE_QUIET_ZONE_MODULES } from '../../lib/barcodeSymbology.js';
import { fitsMinimumModuleSize, moduleSizeMm } from '../../lib/barcodeSizing.js';

/**
 * Lado do simbolo em modulos, zona de silencio incluida. O codigo realista do
 * catalogo cabe na versao 1 do simbolo, que tem 21 modulos por lado; a zona de
 * silencio acrescenta quatro de cada lado. A contagem e constante, entao a
 * zona do simbolo e dimensionada uma vez e serve para o catalogo inteiro.
 */
export const NOMINAL_SYMBOL_MODULES = 21;
export const NOMINAL_TOTAL_MODULES = NOMINAL_SYMBOL_MODULES + BARCODE_QUIET_ZONE_MODULES * 2;

/** Corpo do nome como fracao da largura util, com piso e teto absolutos. */
const NAME_SIZE_RATIO = 0.05;
const NAME_SIZE_MIN_MM = 2.2;
const NAME_SIZE_MAX_MM = 5;
const NAME_MAX_LINES = 3;

/** Altura de linha comum a todos os textos da etiqueta. */
export const LINE_HEIGHT_RATIO = 1.15;

/** O preco e o texto dominante; o codigo numerico e o mais discreto. */
const PRICE_SIZE_RATIO = 1.6;
const CODE_SIZE_RATIO = 0.8;
const CODE_SIZE_MIN_MM = 2;

/**
 * Afastamento minimo entre a caixa do simbolo e o texto mais proximo. A zona
 * de silencio ja garante o isolamento optico do simbolo por dentro da caixa;
 * este afastamento e separacao visual e folga para o desregistro da impressao,
 * e acompanha o tamanho do modulo para que a etiqueta grande nao fique apertada.
 */
const SYMBOL_GAP_MIN_MM = 1.5;
const SYMBOL_GAP_MODULES = 2;

export class LabelGeometryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LabelGeometryError';
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Zonas fixas do modelo informado. Lanca quando o modelo nao comporta o
 * contrato visual: simbolo abaixo do piso de legibilidade, coluna de texto sem
 * largura, ou area util sem altura para uma linha de nome ao lado do simbolo.
 *
 * `totalModules` existe para o dia em que um codigo estourar a versao 1 do
 * simbolo: quem ja tem o simbolo em maos passa a contagem real e confere se o
 * modelo continua legivel.
 */
export function computeLabelGeometry(layout, totalModules = NOMINAL_TOTAL_MODULES) {
  const { widthMm, heightMm, paddingMm, symbolSizeMm } = layout;

  const usable = {
    xMm: paddingMm,
    yMm: paddingMm,
    widthMm: widthMm - paddingMm * 2,
    heightMm: heightMm - paddingMm * 2,
  };

  if (usable.widthMm <= 0 || usable.heightMm <= 0) {
    throw new LabelGeometryError('A margem interna nao deixa area util na etiqueta.');
  }

  if (symbolSizeMm > usable.widthMm || symbolSizeMm > usable.heightMm) {
    throw new LabelGeometryError('O simbolo nao cabe na area util da etiqueta.');
  }

  if (!fitsMinimumModuleSize(totalModules, symbolSizeMm)) {
    throw new LabelGeometryError(
      'O simbolo deste modelo fica abaixo do tamanho minimo de modulo e nao seria lido depois de impresso.',
    );
  }

  const symbolModuleSizeMm = moduleSizeMm(totalModules, symbolSizeMm);
  const gapMm = Math.max(SYMBOL_GAP_MIN_MM, SYMBOL_GAP_MODULES * symbolModuleSizeMm);

  const nameFontSizeMm = clamp(usable.widthMm * NAME_SIZE_RATIO, NAME_SIZE_MIN_MM, NAME_SIZE_MAX_MM);
  const nameLineHeightMm = nameFontSizeMm * LINE_HEIGHT_RATIO;
  const heightAboveSymbol = usable.heightMm - symbolSizeMm - gapMm;

  if (heightAboveSymbol < nameLineHeightMm) {
    throw new LabelGeometryError(
      'A area util nao comporta uma linha de nome acima do simbolo neste modelo.',
    );
  }

  const nameLines = clamp(Math.floor(heightAboveSymbol / nameLineHeightMm), 1, NAME_MAX_LINES);

  const name = {
    xMm: usable.xMm,
    yMm: usable.yMm,
    widthMm: usable.widthMm,
    heightMm: nameLines * nameLineHeightMm,
    fontSizeMm: nameFontSizeMm,
    lineHeightMm: nameLineHeightMm,
    lines: nameLines,
  };

  const symbol = {
    xMm: usable.xMm + usable.widthMm - symbolSizeMm,
    yMm: usable.yMm + usable.heightMm - symbolSizeMm,
    sizeMm: symbolSizeMm,
    moduleSizeMm: symbolModuleSizeMm,
    totalModules,
  };

  const columnWidthMm = usable.widthMm - symbolSizeMm - gapMm;

  if (columnWidthMm <= 0) {
    throw new LabelGeometryError(
      'O simbolo ocupa a largura util inteira e nao sobra coluna para o preco e o codigo.',
    );
  }

  const column = {
    xMm: usable.xMm,
    yMm: usable.yMm + name.heightMm + gapMm,
    widthMm: columnWidthMm,
    heightMm: usable.yMm + usable.heightMm - (usable.yMm + name.heightMm + gapMm),
  };

  const priceFontSizeMm = nameFontSizeMm * PRICE_SIZE_RATIO;
  const codeFontSizeMm = Math.max(CODE_SIZE_MIN_MM, nameFontSizeMm * CODE_SIZE_RATIO);
  const priceHeightMm = priceFontSizeMm * LINE_HEIGHT_RATIO;
  const codeHeightMm = codeFontSizeMm * LINE_HEIGHT_RATIO;

  if (priceHeightMm + codeHeightMm > column.heightMm) {
    throw new LabelGeometryError(
      'A coluna de texto nao comporta o preco e o codigo numerico neste modelo.',
    );
  }

  const price = {
    xMm: column.xMm,
    yMm: column.yMm,
    widthMm: column.widthMm,
    heightMm: priceHeightMm,
    fontSizeMm: priceFontSizeMm,
  };

  const code = {
    xMm: column.xMm,
    yMm: column.yMm + column.heightMm - codeHeightMm,
    widthMm: column.widthMm,
    heightMm: codeHeightMm,
    fontSizeMm: codeFontSizeMm,
  };

  return Object.freeze({
    widthMm,
    heightMm,
    gapMm,
    usable,
    name,
    symbol,
    column,
    price,
    code,
  });
}

/** Caixa envolvente de uma zona, para a prova de que duas zonas nao se tocam. */
export function zoneBounds(zone) {
  return {
    left: zone.xMm,
    top: zone.yMm,
    right: zone.xMm + (zone.widthMm ?? zone.sizeMm),
    bottom: zone.yMm + (zone.heightMm ?? zone.sizeMm),
  };
}

/** Responde se duas zonas se sobrepoem em area, sem renderizar nada. */
export function zonesOverlap(first, second) {
  const a = zoneBounds(first);
  const b = zoneBounds(second);

  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
