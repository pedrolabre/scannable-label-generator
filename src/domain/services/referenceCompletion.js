import { planCatalogCompletion } from './catalogCompletion.js';
import { ENRICHABLE_FIELDS } from './productEnrichment.js';

/**
 * Complementacao do catalogo pela base de referencia, sem arquivo.
 *
 * O Completar dados le um arquivo e preenche os campos vazios do catalogo. Aqui
 * a fonte e a base ja guardada: cada produto sem NCM ou sem codigo de barras e
 * procurado nela pelo proprio codigo, e o que ela tem vira um registro igual
 * ao de um arquivo lido, com o codigo do produto e os dois campos. A partir
 * dai o calculo e o mesmo do Completar dados: so o campo vazio e preenchido,
 * o valor passa pelo contrato do produto, nenhum produto e criado.
 *
 * Todos os produtos sao procurados, para que o NCM da base diferente do
 * cadastrado apareca como divergencia.
 *
 * O dominio nao consulta armazenamento: quem chama pede a base com os codigos
 * de `referenceCodesToAsk` e entrega o mapa pronto, o mesmo que a busca em
 * lista devolve.
 *
 * Funcao pura: nao toca em armazenamento e nao le relogio.
 */

function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function lacksReferenceField(product) {
  return ENRICHABLE_FIELDS.some((field) => isEmpty(product[field]));
}

/**
 * Codigos dos produtos que tem NCM ou codigo de barras vazio, como estao
 * gravados, sem repetir. Produto completo nao entra: nao ha o que procurar.
 */
export function referenceCodesToAsk(products) {
  const codes = new Set();

  for (const product of products) {
    if (lacksReferenceField(product)) {
      codes.add(product.systemCode);
    }
  }

  return [...codes];
}

/** Codigos de todos os produtos, sem repetir: os procurados na base. */
export function referenceCodesToCheck(products) {
  return [...new Set(products.map((product) => product.systemCode))];
}

function recordFor(code, reference) {
  const candidate = { systemCode: code };

  for (const field of ENRICHABLE_FIELDS) {
    if (!isEmpty(reference[field])) {
      candidate[field] = reference[field];
    }
  }

  return { candidate, candidateIssues: [] };
}

/**
 * O que a base completa no catalogo, e as contagens.
 *
 * `references` e o mapa da busca em lista, do codigo como foi pedido para o que
 * a base tem dele. Devolve os produtos que mudam, as divergencias de NCM, o
 * resumo do calculo do Completar dados e quantos dos codigos sem NCM ou sem
 * codigo de barras nao estavam na base.
 */
export function planReferenceCompletion(products, references, options) {
  const asked = referenceCodesToAsk(products);
  const records = [];

  for (const code of referenceCodesToCheck(products)) {
    const reference = references.get(code);

    if (reference) {
      records.push(recordFor(code, reference));
    }
  }

  const plan = planCatalogCompletion(products, records, options);
  const outsideReference = asked.filter((code) => !references.has(code)).length;

  return {
    products: plan.products,
    divergences: plan.divergences,
    summary: { ...plan.summary, askedCodes: asked.length, outsideReference },
  };
}
