/**
 * Descricao do documento de impressao, em milimetros reais.
 *
 * Funcao pura: sem DOM, sem React, sem armazenamento e sem nenhuma biblioteca
 * de PDF. O que sai daqui e a folha inteira escrita como dados — paginas, e em
 * cada pagina retangulos, caminhos, textos e imagens em coordenada absoluta da
 * folha.
 * Quem traduz isso para chamadas de uma biblioteca e o adaptador, e a separacao
 * e o que permite conferir a geometria do arquivo sem abrir arquivo nenhum.
 *
 *   x cresce para a direita, y cresce para baixo, origem no canto superior
 *   esquerdo da pagina. E a mesma convencao da grade e das zonas da etiqueta.
 *
 * As medidas sao as mesmas que a tela desenha, porque saem das mesmas funcoes:
 * `computeSheetGrid` para a posicao na folha, `computeLabelGeometry` para as
 * zonas da etiqueta, e `describeLabelContent` para o texto. Uma segunda regra
 * de corte para o papel faria a previa deixar de prever o papel.
 */

import { readSymbolPath, scaleSymbolPath } from '../../lib/symbolPath.js';

import { describeLabelContent, describeLabelLogo } from './labelContent.js';
import { computeLabelGeometry } from './labelGeometry.js';
import { labelsOnSheet, paginateLabels } from './sheetPagination.js';
import { describeProductSymbolSupport } from './symbolContent.js';

/** Traco do contorno da etiqueta: fino, cinza claro, so como guia de corte. */
const OUTLINE_WIDTH_MM = 0.1;
const OUTLINE_GRAY = 203;

/** Marcador do produto cujo codigo nao produz simbolo. */
const FAILED_SYMBOL_LABEL = 'Sem símbolo';
const FAILED_SYMBOL_GRAY = 128;
const FAILED_SYMBOL_DASH_MM = 1;
const FAILED_SYMBOL_MAX_SIZE_MM = 3;
const FAILED_SYMBOL_SIZE_DIVISOR = 8;

/**
 * Nome unico da imagem do logotipo no documento. Todas as etiquetas desenham a
 * mesma imagem, e o nome faz o arquivo guarda-la uma vez so, por mais etiquetas
 * que a folha tenha.
 */
export const LOGO_IMAGE_ALIAS = 'logotipo';

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
 * O texto sai de `describeLabelContent`, a mesma lista que a tela desenha. O
 * simbolo entra como caminho preenchido, na escala da propria caixa, com a
 * zona de silencio que o gerador ja embutiu. Quando o simbolo falta, entra o
 * mesmo marcador que a tela desenha, e o restante do conteudo sai igual.
 */
function describeLabel({ product, geometry, origin, symbol, symbolError, header }) {
  const ops = [
    whiteRect(origin.xMm, origin.yMm, geometry.widthMm, geometry.heightMm),
    outline(origin.xMm, origin.yMm, geometry.widthMm, geometry.heightMm, OUTLINE_GRAY, null),
  ];

  describeLabelContent({ product, geometry, ...header }).forEach((item) => {
    ops.push(
      textOp({
        text: item.uppercase ? item.text.toLocaleUpperCase('pt-BR') : item.text,
        xMm: origin.xMm + item.xMm,
        yMm: origin.yMm + item.yMm,
        widthMm: item.widthMm,
        lineHeightMm: item.lineHeightMm,
        fontSizeMm: item.fontSizeMm,
        bold: item.bold,
        align: item.align,
        // O preco e o codigo ja foram medidos por degrau de corpo e nunca sao
        // cortados; o resto ganha a segunda guarda, com a largura real da fonte.
        trim: item.role !== 'price' && item.role !== 'code',
      }),
    );
  });

  const logo = describeLabelLogo({ geometry, logo: header.logo });

  if (logo) {
    ops.push(
      Object.freeze({
        type: 'image',
        dataUrl: logo.dataUrl,
        format: logo.format,
        alias: LOGO_IMAGE_ALIAS,
        xMm: origin.xMm + logo.xMm,
        yMm: origin.yMm + logo.yMm,
        widthMm: logo.widthMm,
        heightMm: logo.heightMm,
      }),
    );
  }

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
        symbolText: symbol.text,
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
 * Cada copia e um exemplar com simbolo proprio. `symbols` e um mapa do texto do
 * simbolo para `{ symbol, error }`; texto ausente do mapa, ou exemplar cujo
 * texto o contrato recusa, sai com o marcador de falha, e nunca em branco.
 *
 * `header` leva o logotipo, o nome da empresa e o parcelamento ja resolvidos,
 * os mesmos da previa.
 */
export function describePrintDocument({
  job,
  sheet,
  labelLayout,
  grid,
  products,
  symbols,
  header = {},
}) {
  const geometry = computeLabelGeometry(labelLayout);
  const byId = new Map(products.map((product) => [product.id, product]));
  const { totalSheets } = paginateLabels(job.items, grid.perSheet);
  const labelHeader = {
    companyName: header.companyName ?? null,
    installmentText: header.installmentText ?? null,
    logo: header.logo ?? null,
  };
  const pages = [];

  for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex += 1) {
    const ops = [];

    labelsOnSheet(job.items, grid.perSheet, sheetIndex).forEach((slot) => {
      const product = byId.get(slot.productId);
      const cell = grid.cells[slot.cellIndex];

      if (!product || !cell) {
        return;
      }

      const content = describeProductSymbolSupport(product, slot.copyNumber);
      const resolved = content.supported ? symbols?.get(content.text) : null;

      describeLabel({
        product,
        geometry,
        origin: { xMm: cell.xMm, yMm: cell.yMm },
        symbol: resolved?.symbol ?? null,
        symbolError: content.error ?? resolved?.error ?? null,
        header: labelHeader,
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
