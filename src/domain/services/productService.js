import { ProductSchema } from '../schemas/productSchema.js';

/**
 * Montagem do produto: identificador e carimbos de tempo nascem aqui, fora da
 * tela que coletou os dados, para que formulario e importacao em lote gerem
 * registros identicos.
 */

/**
 * Identificador do produto no formato UUID exigido pelo contrato. Usa o gerador
 * nativo do navegador, disponivel em contexto seguro (HTTPS e localhost).
 */
export function generateProductId() {
  return crypto.randomUUID();
}

function currentTimestamp() {
  return new Date().toISOString();
}

/**
 * Monta um produto novo a partir dos campos ja preenchidos. `id` e as duas
 * datas podem ser injetados para tornar o resultado reproduzivel.
 */
export function buildNewProduct(fields, { id = generateProductId(), now = currentTimestamp() } = {}) {
  return {
    ...fields,
    id,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Monta a versao atualizada de um produto ja gravado: identificador e data de
 * criacao vem do registro anterior, e so `updatedAt` avanca.
 */
export function buildUpdatedProduct(product, fields, { now = currentTimestamp() } = {}) {
  return {
    ...fields,
    id: product.id,
    createdAt: product.createdAt,
    updatedAt: now,
  };
}

/**
 * Confere o produto montado contra o contrato. Em caso de falha devolve a
 * primeira mensagem de cada campo, ja pronta para aparecer ao lado do controle
 * que a originou.
 */
export function validateProduct(candidate) {
  const result = ProductSchema.safeParse(candidate);

  if (result.success) {
    return { success: true, product: result.data, fieldErrors: {} };
  }

  const fieldErrors = {};

  for (const [field, messages] of Object.entries(result.error.flatten().fieldErrors)) {
    if (messages && messages.length > 0) {
      fieldErrors[field] = messages[0];
    }
  }

  return { success: false, product: null, fieldErrors };
}
