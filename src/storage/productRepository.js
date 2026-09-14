import { ProductSchema } from '../domain/schemas/productSchema.js';

import { db } from './indexed-db.js';

/**
 * Unico caminho de leitura e escrita da tabela de produtos. Toda gravacao passa
 * pelo `ProductSchema`, entao nenhum registro fora do contrato chega ao
 * IndexedDB, venha ele do formulario ou de uma importacao em lote.
 */

export function listProducts() {
  return db.products.toArray();
}

/**
 * Valida o produto e grava o resultado do parse, ja com os textos aparados e os
 * campos opcionais ausentes removidos. Rejeita quando o registro esta fora do
 * contrato ou quando o identificador ja existe.
 */
export async function createProduct(product) {
  const validated = ProductSchema.parse(product);

  await db.products.add(validated);

  return validated;
}

/**
 * Valida o produto e regrava o registro inteiro sobre o identificador que ele
 * carrega. A substituicao do registro inteiro e o que faz um campo opcional
 * esvaziado desaparecer de fato, em vez de sobreviver da versao anterior.
 */
export async function updateProduct(product) {
  const validated = ProductSchema.parse(product);

  await db.products.put(validated);

  return validated;
}

export function deleteProduct(id) {
  return db.products.delete(id);
}

/**
 * Roda um conjunto de escritas numa transacao unica da tabela de produtos.
 *
 * Existe para que a gravacao em lote possa fechar um grupo de registros de uma
 * vez: ou o grupo inteiro entra, ou nenhum registro dele entra. Com isso, "o que
 * foi gravado" continua sendo um trecho inicial exato do lote mesmo quando uma
 * escrita falha no meio, e a retomada nao precisa adivinhar onde parou.
 *
 * A funcao mora aqui, e nao no servico que orquestra a gravacao, porque este e o
 * unico modulo que conhece o banco. Quem chama entrega as escritas e nao
 * enxerga a biblioteca de persistencia.
 */
export function runProductsTransaction(write) {
  return db.transaction('rw', db.products, write);
}
