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
  ncm: '',
  price: '',
  category: '',
  notes: '',
};

// Campos que o contrato aceita ausentes: em branco, saem do objeto em vez de
// virarem string vazia.
const OPTIONAL_TEXT_FIELDS = ['description', 'ean', 'ncm', 'category', 'notes'];

/**
 * O NCM costuma ser copiado da nota no formato 9403.50.00. Os pontos e os
 * espacos saem antes do contrato, que guarda so os oito digitos; o que sobrar
 * de diferente continua indo ao contrato, que diz o que esta errado.
 */
function normalizeNcmText(text) {
  return text.replace(/[.\s]/g, '');
}

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
    ncm: product.ncm ?? '',
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
    const raw = values[field].trim();
    const text = field === 'ncm' ? normalizeNcmText(raw) : raw;

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
