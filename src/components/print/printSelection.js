/**
 * Resolve quais produtos entram na folha, a partir da selecao guardada e da
 * lista de produtos que esta em memoria.
 *
 * A selecao guarda identificador e quantidade, e nunca o objeto do produto. E
 * isso que faz a lista da impressao acompanhar a edicao sem nenhum codigo de
 * sincronizacao, largar sozinha o produto removido, e continuar valendo quando a
 * listagem e relida: nos tres casos a resposta sai da lista atual, e nunca de
 * uma copia guardada antes. Identificador que sobra na selecao e inofensivo,
 * porque a resolucao e a unica fonte da verdade e o trabalho e transiente.
 *
 * Funcoes puras, sem DOM e sem React: os tres casos sao conferidos por calculo.
 */

export function resolvePrintItems(products, selection) {
  if (!Array.isArray(products) || !Array.isArray(selection)) {
    return [];
  }

  const byId = new Map(products.map((product) => [product.id, product]));

  return selection
    .map((entry) => {
      const product = byId.get(entry.productId);

      return product ? { product, copies: entry.copies } : null;
    })
    .filter(Boolean);
}

/** Conjunto de identificadores marcados, para a listagem consultar por item. */
export function selectedPrintIds(selection) {
  if (!Array.isArray(selection)) {
    return new Set();
  }

  return new Set(selection.map((entry) => entry.productId));
}
