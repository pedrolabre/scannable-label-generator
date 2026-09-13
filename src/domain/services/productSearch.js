/**
 * Busca e ordenacao da lista de produtos. Vive fora dos componentes porque a
 * normalizacao de texto vale para qualquer origem de dado, e nao so para o que
 * foi digitado no campo de busca.
 */

const DIACRITICS = /\p{Diacritic}/gu;

/**
 * Forma comparavel de um texto: sem acentuacao, em caixa baixa e sem espacos
 * nas pontas. Os dados reais chegam de notas fiscais escritas em portugues,
 * entao "acucar" e "Acucar" precisam encontrar um ao outro nos dois sentidos.
 */
export function normalizeSearchText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim();
}

// Onde a busca entra: o nome impresso e os dois codigos. Categoria, descricao e
// observacoes ficam de fora para que o campo continue procurando um produto em
// vez de devolver um grupo inteiro.
const SEARCHABLE_FIELDS = ['displayName', 'systemCode', 'ean'];

function matches(product, term) {
  return SEARCHABLE_FIELDS.some((field) => normalizeSearchText(product[field]).includes(term));
}

/**
 * Produtos que contem o termo em algum dos campos pesquisaveis. Um termo vazio
 * devolve a propria lista recebida, sem copia nem varredura.
 */
export function searchProducts(products, query) {
  const term = normalizeSearchText(query);

  if (term === '') {
    return products;
  }

  return products.filter((product) => matches(product, term));
}

const NAME_COLLATOR = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * Ordem de leitura da listagem, pelo nome da etiqueta. A tabela chega do banco
 * ordenada pelo identificador, que e um UUID: sem esta comparacao, a posicao de
 * um produto na tela logo apos o cadastro e diferente da posicao dele na
 * proxima abertura do aplicativo.
 */
export function compareProductsByName(first, second) {
  return NAME_COLLATOR.compare(first.displayName, second.displayName);
}
