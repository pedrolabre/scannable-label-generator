// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { resolvePrintItems, selectedPrintIds } from './printSelection.js';

const ARMARIO = {
  id: '11111111-1111-4111-8111-111111111111',
  systemCode: 'MOV-00412',
  displayName: 'Armário de cozinha',
  priceInCentavos: 89990,
};

const GELADEIRA = {
  id: '22222222-2222-4222-8222-222222222222',
  systemCode: 'ELE-00713',
  displayName: 'Geladeira duas portas',
  priceInCentavos: 329900,
};

const SELECTION = [
  { productId: ARMARIO.id, copies: '3' },
  { productId: GELADEIRA.id, copies: '10' },
];

describe('resolvePrintItems', () => {
  it('resolve cada identificador contra a lista atual, na ordem em que foi marcado', () => {
    const items = resolvePrintItems([GELADEIRA, ARMARIO], SELECTION);

    expect(items).toEqual([
      { product: ARMARIO, copies: '3' },
      { product: GELADEIRA, copies: '10' },
    ]);
  });

  it('larga o produto removido da lista e mantem o restante da selecao intacto', () => {
    const items = resolvePrintItems([GELADEIRA], SELECTION);

    expect(items).toHaveLength(1);
    expect(items[0].product).toBe(GELADEIRA);
    expect(items[0].copies).toBe('10');
  });

  it('devolve lista vazia quando todos os produtos selecionados sairam', () => {
    expect(resolvePrintItems([], SELECTION)).toEqual([]);
  });

  it('entrega o produto editado, e nao a copia guardada quando ele foi marcado', () => {
    const editado = { ...ARMARIO, displayName: 'Armário de cozinha seis portas' };

    const [item] = resolvePrintItems([editado], [SELECTION[0]]);

    expect(item.product).toBe(editado);
    expect(item.product.displayName).toBe('Armário de cozinha seis portas');
  });

  it('continua valendo quando a listagem e relida em novos objetos', () => {
    const relida = [{ ...ARMARIO }, { ...GELADEIRA }];

    expect(resolvePrintItems(relida, SELECTION)).toHaveLength(2);
  });

  it('responde vazio quando falta a lista ou a selecao', () => {
    expect(resolvePrintItems(null, SELECTION)).toEqual([]);
    expect(resolvePrintItems([ARMARIO], null)).toEqual([]);
  });
});

describe('selectedPrintIds', () => {
  it('reune os identificadores marcados para a consulta item a item', () => {
    const ids = selectedPrintIds(SELECTION);

    expect(ids.has(ARMARIO.id)).toBe(true);
    expect(ids.has(GELADEIRA.id)).toBe(true);
    expect(ids.size).toBe(2);
  });

  it('responde conjunto vazio sem selecao', () => {
    expect(selectedPrintIds(null).size).toBe(0);
  });
});
