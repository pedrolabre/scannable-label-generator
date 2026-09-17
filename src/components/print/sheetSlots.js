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
