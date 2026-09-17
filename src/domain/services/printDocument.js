/**
 * Descricao do documento de impressao, em milimetros reais.
 *
 * Funcao pura: sem DOM, sem React, sem armazenamento e sem nenhuma biblioteca
 * de PDF. O que sai daqui e a folha inteira escrita como dados — paginas, e em
 * cada pagina retangulos, caminhos e textos em coordenada absoluta da folha.
 * Quem traduz isso para chamadas de uma biblioteca e o adaptador, e a separacao
 * e o que permite conferir a geometria do arquivo sem abrir arquivo nenhum.
 *
 *   x cresce para a direita, y cresce para baixo, origem no canto superior
 *   esquerdo da pagina. E a mesma convencao da grade e das zonas da etiqueta.
 *
 * As medidas sao as mesmas que a tela desenha, porque saem das mesmas funcoes:
 * `computeSheetGrid` para a posicao na folha, `computeLabelGeometry` para as
 * zonas da etiqueta, e `fitNameLines`, `fitPriceText` e `fitCodeText` para o
 * texto. Uma segunda regra de corte para o papel faria a previa deixar de
 * prever o papel.
 */

import { readSymbolPath, scaleSymbolPath } from '../../lib/symbolPath.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';

import { computeLabelGeometry } from './labelGeometry.js';
import { fitCodeText, fitNameLines, fitPriceText } from './labelText.js';
import { labelsOnSheet, paginateLabels } from './sheetPagination.js';

/** Traco do contorno da etiqueta: fino, cinza claro, so como guia de corte. */
const OUTLINE_WIDTH_MM = 0.1;
const OUTLINE_GRAY = 203;

/** Marcador do produto cujo codigo nao produz simbolo. */
const FAILED_SYMBOL_LABEL = 'Sem símbolo';
const FAILED_SYMBOL_GRAY = 128;
const FAILED_SYMBOL_DASH_MM = 1;
const FAILED_SYMBOL_MAX_SIZE_MM = 3;
const FAILED_SYMBOL_SIZE_DIVISOR = 8;

function whiteRect(xMm, yMm, widthMm, heightMm) {
  return Object.freeze({ type: 'rect', xMm, yMm, widthMm, heightMm, fill: 'white' });
}

function outline(xMm, yMm, widthMm, heightMm, gray, dashMm) {
  return Object.freeze({
    type: 'outline',
    xMm,
    yMm,
    widthMm,
    heightMm,
    lineWidthMm: OUTLINE_WIDTH_MM,
    gray,
    dashMm,
  });
}

function textOp({ text, xMm, yMm, widthMm, lineHeightMm, fontSizeMm, bold, align, trim }) {
  return Object.freeze({
    type: 'text',
    text,
    xMm,
    yMm,
    widthMm,
    lineHeightMm,
    fontSizeMm,
    bold,
    align,
    trim,
  });
}

/**
 * Operacoes de uma etiqueta, ja deslocadas para a posicao dela na folha.
 *
 * O simbolo entra como caminho preenchido, na escala da propria caixa, com a
 * zona de silencio que o gerador ja embutiu. Quando o simbolo falta, entra o
 * mesmo marcador que a tela desenha, e o restante do conteudo sai igual.
 */
function describeLabel({ product, geometry, origin, symbol, symbolError }) {
  const ops = [
    whiteRect(origin.xMm, origin.yMm, geometry.widthMm, geometry.heightMm),
    outline(origin.xMm, origin.yMm, geometry.widthMm, geometry.heightMm, OUTLINE_GRAY, null),
  ];

  const name = fitNameLines(product.displayName, geometry.name);

  name.lines.forEach((line, index) => {
    ops.push(
      textOp({
        text: line.toLocaleUpperCase('pt-BR'),
        xMm: origin.xMm + geometry.name.xMm,
        yMm: origin.yMm + geometry.name.yMm + index * geometry.name.lineHeightMm,
        widthMm: geometry.name.widthMm,
        lineHeightMm: geometry.name.lineHeightMm,
        fontSizeMm: geometry.name.fontSizeMm,
        bold: true,
        align: 'left',
        trim: true,
      }),
    );
  });

  const price = fitPriceText(formatCentavosAsBRL(product.priceInCentavos) ?? '', geometry.price);

  ops.push(
    textOp({
      text: price.text,
      xMm: origin.xMm + geometry.price.xMm,
      yMm: origin.yMm + geometry.price.yMm,
      widthMm: geometry.price.widthMm,
      lineHeightMm: geometry.price.heightMm,
      fontSizeMm: price.fontSizeMm,
      bold: true,
      align: 'left',
      trim: false,
    }),
  );

  const code = fitCodeText(product.systemCode, geometry.code);

  ops.push(
    textOp({
      text: code.text,
      xMm: origin.xMm + geometry.code.xMm,
      yMm: origin.yMm + geometry.code.yMm,
      widthMm: geometry.code.widthMm,
      lineHeightMm: geometry.code.heightMm,
      fontSizeMm: code.fontSizeMm,
      bold: false,
      align: 'left',
      trim: false,
    }),
  );

  const zone = {
    xMm: origin.xMm + geometry.symbol.xMm,
    yMm: origin.yMm + geometry.symbol.yMm,
    sizeMm: geometry.symbol.sizeMm,
  };

  // O fundo branco da caixa do simbolo e explicito, como no desenho da tela:
  // fundo herdado deixaria a cor do papel invadir a zona de silencio.
  ops.push(whiteRect(zone.xMm, zone.yMm, zone.sizeMm, zone.sizeMm));

  if (symbol && !symbolError) {
    ops.push(
      Object.freeze({
        type: 'path',
        subpaths: Object.freeze(
          scaleSymbolPath(readSymbolPath(symbol.svg), zone).map((points) => Object.freeze(points)),
        ),
      }),
    );

    return ops;
  }

  ops.push(outline(zone.xMm, zone.yMm, zone.sizeMm, zone.sizeMm, FAILED_SYMBOL_GRAY, FAILED_SYMBOL_DASH_MM));

  const markerSizeMm = Math.min(zone.sizeMm / FAILED_SYMBOL_SIZE_DIVISOR, FAILED_SYMBOL_MAX_SIZE_MM);

  ops.push(
    textOp({
      text: FAILED_SYMBOL_LABEL,
      xMm: zone.xMm,
      yMm: zone.yMm,
      widthMm: zone.sizeMm,
      lineHeightMm: zone.sizeMm,
      fontSizeMm: markerSizeMm,
      bold: false,
      align: 'center',
      trim: false,
    }),
  );

  return ops;
}

/**
 * Descreve o documento inteiro do trabalho: uma pagina por folha, na ordem em
 * que o operador marcou os produtos, com as copias de cada produto juntas e a
 * folha preenchida por linha.
 *
 * `symbols` e um mapa de codigo do sistema para `{ symbol, error }`. Codigo
 * ausente do mapa e tratado como codigo sem simbolo: a etiqueta sai com o
 * marcador de falha, e nunca em branco.
 */
export function describePrintDocument({ job, sheet, labelLayout, grid, products, symbols }) {
  const geometry = computeLabelGeometry(labelLayout);
  const byId = new Map(products.map((product) => [product.id, product]));
  const { totalSheets } = paginateLabels(job.items, grid.perSheet);
  const pages = [];

  for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex += 1) {
    const ops = [];

    labelsOnSheet(job.items, grid.perSheet, sheetIndex).forEach((slot) => {
      const product = byId.get(slot.productId);
      const cell = grid.cells[slot.cellIndex];

      if (!product || !cell) {
        return;
      }

      const resolved = symbols?.get(product.systemCode);

      describeLabel({
        product,
        geometry,
        origin: { xMm: cell.xMm, yMm: cell.yMm },
        symbol: resolved?.symbol ?? null,
        symbolError: resolved?.error ?? null,
      }).forEach((op) => ops.push(op));
    });

    pages.push(
      Object.freeze({
        widthMm: sheet.widthMm,
        heightMm: sheet.heightMm,
        ops: Object.freeze(ops),
      }),
    );
  }

  return Object.freeze({
    title: `Etiquetas - ${labelLayout.name} - ${sheet.name}`,
    pages: Object.freeze(pages),
  });
}
