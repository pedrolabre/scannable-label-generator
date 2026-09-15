/**
 * Resolve qual produto a previa desenha, a partir do identificador escolhido na
 * listagem e da lista de produtos que esta em memoria.
 *
 * A escolha e guardada por identificador, e nao pelo objeto do produto. E isso
 * que faz a previa acompanhar a edicao sem nenhum codigo de sincronizacao,
 * esvaziar sozinha quando o produto e removido, e continuar valendo quando a
 * listagem e relida: nos tres casos a resposta sai da lista atual, e nunca de
 * uma copia guardada antes.
 *
 * Funcao pura, sem DOM e sem React: os tres casos sao conferidos por calculo.
 */
export function resolveSelectedProduct(products, selectedId) {
  if (!selectedId || !Array.isArray(products)) {
    return null;
  }

  return products.find((product) => product.id === selectedId) ?? null;
}
