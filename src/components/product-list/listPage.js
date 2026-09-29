/**
 * Divisao da listagem em paginas de tamanho fixo.
 *
 * Funcoes puras, sem DOM e sem React. A pagina sai do resultado que a busca ja
 * filtrou e ordenou: a busca continua olhando o catalogo inteiro, e o corte so
 * decide quantos produtos desse resultado vao para a tela de cada vez. O
 * indice comeca em zero e o texto comeca em 1.
 *
 * O tamanho e fixo porque o que ele limita e o desenho: cada produto vira uma
 * linha da tabela e um cartao, montados juntos, e um catalogo inteiro na tela
 * ocupava gigabytes e minutos para montar.
 */

export const LIST_PAGE_SIZE = 50;

/** Quantas paginas o resultado ocupa. Resultado vazio nao tem pagina. */
export function countListPages(total, pageSize = LIST_PAGE_SIZE) {
  if (!Number.isInteger(total) || total <= 0 || pageSize <= 0) {
    return 0;
  }

  return Math.ceil(total / pageSize);
}

/**
 * Traz a pagina pedida para dentro do intervalo que existe. O resultado pode
 * encolher com a ultima pagina na tela, como na remocao do ultimo produto
 * dela; a tela mostra entao a nova ultima, em vez de uma pagina vazia.
 */
export function clampListPage(pageIndex, totalPages) {
  if (totalPages <= 0 || !Number.isInteger(pageIndex) || pageIndex < 0) {
    return 0;
  }

  return Math.min(pageIndex, totalPages - 1);
}

/** Os produtos de uma pagina, na ordem em que chegaram. */
export function itemsOnListPage(items, pageIndex, pageSize = LIST_PAGE_SIZE) {
  if (!Array.isArray(items) || pageSize <= 0 || pageIndex < 0) {
    return [];
  }

  const start = pageIndex * pageSize;

  return items.slice(start, start + pageSize);
}

/**
 * Posicao do primeiro e do ultimo produto da pagina dentro do resultado,
 * contadas a partir de 1, para o indicador dizer que trecho esta na tela.
 */
export function listPageRange(total, pageIndex, pageSize = LIST_PAGE_SIZE) {
  if (!Number.isInteger(total) || total <= 0 || pageSize <= 0 || pageIndex < 0) {
    return Object.freeze({ first: 0, last: 0 });
  }

  const first = Math.min(pageIndex * pageSize + 1, total);
  const last = Math.min((pageIndex + 1) * pageSize, total);

  return Object.freeze({ first, last });
}
