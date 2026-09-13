import { normalizeSearchText } from './productSearch.js';

/**
 * De onde vem cada campo do produto quando o registro saiu de uma planilha ou
 * de um JSON.
 *
 * CSV e JSON chegam com os nomes que o exportador escreveu, e o mesmo campo
 * aparece como "codigo", "Código do sistema" ou `systemCode` conforme o
 * sistema de origem. A tabela abaixo e a lista fechada de nomes reconhecidos —
 * coluna fora dela simplesmente nao vira campo de produto, e o registro chega a
 * validacao com o campo faltando e o motivo visivel.
 *
 * A comparacao passa por `normalizeSearchText`, entao acentuacao, caixa e
 * espaco nas pontas nao importam: "Descrição", "descricao" e " DESCRICAO "
 * encontram a mesma entrada.
 *
 * `priceInCentavos` nao e aceito como nome de coluna. Quem escreve uma planilha
 * escreve o preco em reais, e uma coluna chamada assim seria lida como reais do
 * mesmo jeito — o nome prometeria centavos e entregaria outra coisa.
 */

const COLUMN_ALIASES = {
  systemCode: ['systemCode', 'codigo', 'codigo do sistema', 'codigo interno', 'cod', 'sku', 'referencia'],
  displayName: ['displayName', 'nome', 'nome da etiqueta', 'nome curto', 'etiqueta'],
  description: ['description', 'descricao', 'descricao completa'],
  priceInCentavos: ['price', 'preco', 'preco unitario', 'preco de venda', 'valor'],
  ean: ['ean', 'gtin', 'codigo de barras', 'codigo ean', 'barras'],
  category: ['category', 'categoria', 'grupo'],
  notes: ['notes', 'observacoes', 'observacao', 'obs'],
};

/**
 * Indice montado uma vez, na carga do modulo: um lote grande percorre este mapa
 * por coluna do arquivo, nao por combinacao de coluna e apelido.
 */
const FIELD_BY_ALIAS = new Map();

for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
  for (const alias of aliases) {
    FIELD_BY_ALIAS.set(normalizeSearchText(alias), field);
  }
}

export function readTabularProductSources(raw) {
  const sources = {};

  for (const [column, value] of Object.entries(raw)) {
    const field = FIELD_BY_ALIAS.get(normalizeSearchText(column));

    // Duas colunas que apontam para o mesmo campo: vale a primeira do arquivo,
    // mesma regra que o leitor de CSV ja aplica a cabecalho repetido.
    if (field !== undefined && sources[field] === undefined) {
      sources[field] = value;
    }
  }

  // Planilha sem coluna de nome curto, mas com descricao, aproveita a descricao
  // como sugestao de nome. O encurtamento e o mesmo do XML.
  if (sources.displayName === undefined) {
    sources.displayName = sources.description;
  }

  return {
    sources,
    // O preco pode vir em qualquer das duas convencoes ("12,50" ou "12.50"), e
    // so o proprio texto diz qual delas e.
    priceDecimalSeparator: 'auto',
    issues: [],
  };
}
