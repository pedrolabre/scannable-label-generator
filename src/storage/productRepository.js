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

export function deleteProduct(id) {
  return db.products.delete(id);
}
