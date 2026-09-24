import { ProductSchema } from '../domain/schemas/productSchema.js';

import { db } from './indexed-db.js';

/**
 * Unico caminho de leitura e escrita da tabela de produtos. Toda gravacao passa
 * pelo `ProductSchema`, entao nenhum registro fora do contrato chega ao
 * IndexedDB, venha ele do formulario, de uma importacao em lote ou de um arquivo
 * de backup.
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
 * Apaga todos os produtos de uma vez. Toca so a tabela de produtos: os modelos
 * sao constante de codigo, e a configuracao da etiqueta vive fora do banco.
 */
export function clearAllProducts() {
  return db.products.clear();
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

/**
 * Troca o conteudo inteiro da tabela pelo conjunto recebido, numa transacao so.
 *
 * A validacao acontece antes de a transacao abrir, e nao dentro dela: um
 * registro fora do contrato precisa impedir a limpeza, e nao interrompe-la pela
 * metade. Depois disso, limpar e regravar e uma operacao unica para o banco —
 * uma falha no meio desfaz as duas pontas e devolve a tabela ao estado anterior.
 *
 * `bulkAdd` grava o conjunto numa chamada, sem ceder o turno, entao a transacao
 * nao fecha sozinha no meio do caminho por mais longo que o conjunto seja.
 */
export async function replaceAllProducts(products) {
  const validated = products.map((product) => ProductSchema.parse(product));

  await runProductsTransaction(async () => {
    await db.products.clear();

    if (validated.length > 0) {
      await db.products.bulkAdd(validated);
    }
  });

  return validated.length;
}
