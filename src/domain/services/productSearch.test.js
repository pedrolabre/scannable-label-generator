// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { inventCatalog, inventProduct } from '../../components/product-list/listFixtures.js';

import {
  buildProductSearchIndex,
  compareProductsByName,
  searchProductIndex,
  searchProducts,
} from './productSearch.js';

// O que a listagem fazia a cada termo antes do catalogo preparado: varrer e
// normalizar a lista inteira e ordenar o resultado.
function searchAsBefore(products, query) {
  return [...searchProducts(products, query)].sort(compareProductsByName);
}

function names(products) {
  return products.map((product) => product.displayName);
}

const sofa = { ...inventProduct(0), displayName: 'Sofá retrátil Veludo', systemCode: '000123', ean: '7891234567895' };
const fogao = { ...inventProduct(3), displayName: 'Fogão cinco bocas Inox', systemCode: '45001', ean: undefined };
const comoda = { ...inventProduct(5), displayName: 'Cômoda com espelho', systemCode: '45002', ean: '7899876543210' };
const CATALOGO = [fogao, comoda, sofa];

describe('busca no catalogo preparado', () => {
  it('encontra pelo nome sem acento e sem diferenca de caixa, nos dois sentidos', () => {
    const index = buildProductSearchIndex(CATALOGO);

    expect(searchProductIndex(index, 'SOFA')).toEqual([sofa]);
    expect(searchProductIndex(index, 'FOGAO CINCO')).toEqual([fogao]);
    expect(searchProductIndex(index, '  CÔMODA ')).toEqual([comoda]);
    expect(searchProductIndex(index, 'cómoda')).toEqual([comoda]);
  });

  it('encontra pelo codigo do sistema e pelo codigo de barras, inteiros ou em parte', () => {
    const index = buildProductSearchIndex(CATALOGO);

    expect(searchProductIndex(index, '000123')).toEqual([sofa]);
    expect(searchProductIndex(index, '4500')).toEqual([comoda, fogao]);
    expect(searchProductIndex(index, '7899876543210')).toEqual([comoda]);
    expect(searchProductIndex(index, '789')).toEqual([comoda, sofa]);
  });

  it('nao procura em categoria, descricao nem observacoes', () => {
    const comDescricao = { ...sofa, category: 'Estofados', description: 'tecido suede' };
    const index = buildProductSearchIndex([comDescricao]);

    expect(searchProductIndex(index, 'estofados')).toEqual([]);
    expect(searchProductIndex(index, 'suede')).toEqual([]);
  });

  it('com o termo vazio devolve o catalogo inteiro em ordem de nome, sempre a mesma lista', () => {
    const index = buildProductSearchIndex(CATALOGO);
    const all = searchProductIndex(index, '');

    expect(names(all)).toEqual(['Cômoda com espelho', 'Fogão cinco bocas Inox', 'Sofá retrátil Veludo']);
    expect(searchProductIndex(index, '   ')).toBe(all);
    expect(searchProductIndex(index, undefined)).toBe(all);
  });

  it('nao mexe na lista recebida', () => {
    const products = [...CATALOGO];

    buildProductSearchIndex(products);

    expect(products).toEqual([fogao, comoda, sofa]);
  });

  it('num catalogo grande devolve os mesmos produtos, na mesma ordem, que a busca de antes', () => {
    const repetidos = [
      { ...inventProduct(30_001), displayName: 'Rack para TV 00010' },
      { ...inventProduct(30_002), displayName: 'rack para tv 00010' },
      { ...inventProduct(30_003), displayName: 'Rack para TV 00010' },
    ];
    const products = [...repetidos.slice(0, 2), ...inventCatalog(19_000), repetidos[2]];
    const index = buildProductSearchIndex(products);
    const terms = [
      '',
      'a',
      'sofa',
      'SOFÁ RETRÁTIL',
      'fogao cinco',
      'colchão casal 0',
      'rack para tv 00010',
      'guarda-roupa',
      '1000',
      '118999',
      '789',
      '7891000000',
      ' comoda ',
      'nada parecido',
    ];

    for (const term of terms) {
      const expected = searchAsBefore(products, term);

      expect(searchProductIndex(index, term), `termo "${term}"`).toEqual(expected);
    }

    // Nomes iguais para a comparacao ficam na ordem em que chegaram.
    expect(searchProductIndex(index, 'rack para tv 00010').map((product) => product.id)).toEqual(
      repetidos.map((product) => product.id),
    );
  });
});
