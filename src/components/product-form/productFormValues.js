import { formatCentavosAsBRL, normalizePriceToCentavos } from '../../lib/currency.js';

/**
 * Traducao entre o que o usuario digita (sempre texto) e os campos do contrato
 * do produto (texto aparado, opcionais ausentes e preco inteiro em centavos).
 */

export const EMPTY_PRODUCT_FORM_VALUES = {
  displayName: '',
  description: '',
  systemCode: '',
  ean: '',
  price: '',
  category: '',
  notes: '',
};

// Campos que o contrato aceita ausentes: em branco, saem do objeto em vez de
// virarem string vazia.
const OPTIONAL_TEXT_FIELDS = ['description', 'ean', 'category', 'notes'];

/** Preenche os controles a partir de um produto ja gravado. */
export function toFormValues(product) {
  if (!product) {
    return { ...EMPTY_PRODUCT_FORM_VALUES };
  }

  return {
    displayName: product.displayName ?? '',
    description: product.description ?? '',
    systemCode: product.systemCode ?? '',
    ean: product.ean ?? '',
    price: formatCentavosAsBRL(product.priceInCentavos) ?? '',
    category: product.category ?? '',
    notes: product.notes ?? '',
  };
}

/**
 * Converte os textos digitados nos campos do contrato. O preco entra pelo
 * normalizador e permanece `null` quando a entrada nao representa um valor
 * monetario, para que o contrato reporte o erro no campo certo.
 */
export function toProductFields(values) {
  const fields = {
    displayName: values.displayName.trim(),
    systemCode: values.systemCode.trim(),
    priceInCentavos: normalizePriceToCentavos(values.price),
  };

  for (const field of OPTIONAL_TEXT_FIELDS) {
    const text = values[field].trim();

    if (text !== '') {
      fields[field] = text;
    }
  }

  return fields;
}

/**
 * Versao em pt-BR do preco digitado, para exibicao enquanto o usuario escreve.
 * Devolve null quando ainda nao ha um valor monetario reconhecivel.
 */
export function previewPrice(priceText) {
  const centavos = normalizePriceToCentavos(priceText);

  return centavos === null ? null : formatCentavosAsBRL(centavos);
}
