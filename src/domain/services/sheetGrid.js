/**
 * Grade de etiquetas numa folha, em milimetros reais.
 *
 * Funcao pura, sem DOM, sem React e sem armazenamento. Recebe a folha e o
 * modelo de etiqueta ja conferidos pelos respectivos contratos e devolve quantas
 * etiquetas cabem e onde cada uma fica.
 *
 *   x cresce para a direita, y cresce para baixo, origem no canto superior
 *   esquerdo da folha.
 *
 * Tres escolhas fixas:
 *
 * - A etiqueta nao gira. As zonas dela foram calculadas para uma orientacao so,
 *   e a folha em paisagem ja cobre o caso em que a outra orientacao rende mais.
 * - A grade parte do canto superior esquerdo da area util, e a sobra fica a
 *   direita e embaixo. A margem digitada pelo operador e a margem que sai no
 *   papel; distribuir a sobra mudaria a posicao de cada etiqueta sem que ele
 *   tivesse pedido.
 * - Etiqueta que nao cabe uma vez na area util nao e recusa de contrato: a
 *   grade sai com zero posicoes, e quem desenha decide como avisar.
 */

/**
 * Tolerancia de comparacao. As medidas andam em passos de meio milimetro, e a
 * soma de fracoes em ponto flutuante pode passar do limite por um residuo que
 * nenhuma impressora enxerga.
 */
const EPSILON_MM = 1e-6;

/** Arredonda a posicao para eliminar o residuo da soma em ponto flutuante. */
function roundMm(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * Quantas pecas de `size` com `gap` entre elas cabem em `available`. A conta e
 * `n * size + (n - 1) * gap <= available`, reescrita para isolar `n`.
 */
function fitCount(available, size, gap) {
  if (size <= 0 || available + EPSILON_MM < size) {
    return 0;
  }

  return Math.floor((available + gap + EPSILON_MM) / (size + gap));
}

export function computeSheetGrid(sheet, labelLayout) {
  const usableWidthMm = roundMm(sheet.widthMm - sheet.marginLeftMm - sheet.marginRightMm);
  const usableHeightMm = roundMm(sheet.heightMm - sheet.marginTopMm - sheet.marginBottomMm);
  const labelWidthMm = labelLayout.widthMm;
  const labelHeightMm = labelLayout.heightMm;

  const columns = fitCount(usableWidthMm, labelWidthMm, sheet.columnGapMm);
  const rows = fitCount(usableHeightMm, labelHeightMm, sheet.rowGapMm);

  // Sem coluna ou sem linha nao ha posicao nenhuma, e o outro eixo deixa de
  // significar alguma coisa.
  const fits = columns > 0 && rows > 0;
  const cells = [];

  if (fits) {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        cells.push(
          Object.freeze({
            index: row * columns + column,
            row,
            column,
            xMm: roundMm(sheet.marginLeftMm + column * (labelWidthMm + sheet.columnGapMm)),
            yMm: roundMm(sheet.marginTopMm + row * (labelHeightMm + sheet.rowGapMm)),
            widthMm: labelWidthMm,
            heightMm: labelHeightMm,
          }),
        );
      }
    }
  }

  return Object.freeze({
    columns: fits ? columns : 0,
    rows: fits ? rows : 0,
    perSheet: cells.length,
    usableWidthMm,
    usableHeightMm,
    cells: Object.freeze(cells),
  });
}

/** Medida em milimetro no formato que o operador le. */
function formatMm(value) {
  return String(value).replace('.', ',');
}

/**
 * Motivo escrito para a grade sem posicao nenhuma. Fica junto do calculo porque
 * as medidas que ele cita sao as que o calculo acabou de usar.
 */
export function describeEmptyGrid(grid, labelLayout) {
  return (
    `A etiqueta de ${formatMm(labelLayout.widthMm)} x ${formatMm(labelLayout.heightMm)} mm ` +
    `não cabe na área útil da folha (${formatMm(grid.usableWidthMm)} x ` +
    `${formatMm(grid.usableHeightMm)} mm). Reduza as margens ou escolha outro modelo.`
  );
}
