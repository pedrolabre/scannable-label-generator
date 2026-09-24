/**
 * Liga as etiquetas de uma folha aos produtos da lista atual e as posicoes da
 * grade. O dominio responde por identificador; a tela precisa do produto para
 * escrever nome, preco e codigo.
 *
 * Funcoes puras, sem DOM e sem React.
 */

export function resolveSheetSlots(slots, products, grid) {
  if (!Array.isArray(slots) || !Array.isArray(products) || !grid) {
    return [];
  }

  const byId = new Map(products.map((product) => [product.id, product]));

  return slots
    .map((slot) => {
      const product = byId.get(slot.productId);
      const cell = grid.cells[slot.cellIndex];

      return product && cell ? { cell, product, copyNumber: slot.copyNumber } : null;
    })
    .filter(Boolean);
}

/** Codigos distintos de uma folha, na ordem em que aparecem. */
export function distinctSystemCodes(resolvedSlots) {
  return [...new Set(resolvedSlots.map((slot) => slot.product.systemCode))];
}

/** Aviso de tiragem que passa de uma folha, ou nulo quando cabe numa so. */
export function describeSheetCount({ totalLabels, totalSheets }, perSheet) {
  if (totalSheets <= 1) {
    return null;
  }

  return `A seleção ocupa ${totalSheets} folhas: ${totalLabels} etiquetas, ${perSheet} por folha.`;
}

/** Capacidade de uma folha, para quem ainda cabe numa so. */
export function describeCapacity({ totalLabels }, perSheet) {
  const labels = totalLabels === 1 ? 'etiqueta' : 'etiquetas';
  const capacity = perSheet === 1 ? 'etiqueta' : 'etiquetas';

  return `${totalLabels} ${labels} numa folha que comporta ${perSheet} ${capacity}.`;
}

/** Colunas por linhas da grade, como o operador conta a folha. */
export function describeGridShape(grid) {
  return `${grid.columns} × ${grid.rows}`;
}

function formatMm(value) {
  return String(value).replace('.', ',');
}

/**
 * As quatro margens numa leitura so. Quando sao iguais, um numero basta; quando
 * nao sao, a ordem e a do relogio a partir do topo, a mesma dos campos.
 */
export function describeSheetMargins(sheet) {
  const margins = [
    sheet.marginTopMm,
    sheet.marginRightMm,
    sheet.marginBottomMm,
    sheet.marginLeftMm,
  ];

  if (margins.every((value) => value === margins[0])) {
    return `${formatMm(margins[0])} mm`;
  }

  return `${margins.map(formatMm).join(' · ')} mm`;
}
