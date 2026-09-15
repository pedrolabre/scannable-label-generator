// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { resolveSelectedProduct } from './previewSelection.js';

function product(id, overrides = {}) {
  return {
    id,
    systemCode: `MOV-${id}`,
    displayName: `Produto ${id}`,
    priceInCentavos: 1000,
    createdAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
    ...overrides,
  };
}

const UM = product('1');
const DOIS = product('2');
const TRES = product('3');

describe('resolveSelectedProduct', () => {
  it('devolve o produto do identificador escolhido', () => {
    expect(resolveSelectedProduct([UM, DOIS, TRES], '2')).toBe(DOIS);
  });

  it('nao escolhe nada enquanto nao ha identificador', () => {
    expect(resolveSelectedProduct([UM, DOIS], null)).toBeNull();
    expect(resolveSelectedProduct([UM, DOIS], '')).toBeNull();
  });

  it('esvazia a escolha quando o produto sai da lista', () => {
    const semDois = [UM, TRES];

    expect(resolveSelectedProduct(semDois, '2')).toBeNull();
  });

  it('acompanha a edicao: o mesmo identificador devolve a versao nova', () => {
    const editado = product('2', { displayName: 'Nome corrigido', priceInCentavos: 2500 });
    const listaDepois = [UM, editado, TRES];

    const resolvido = resolveSelectedProduct(listaDepois, '2');

    expect(resolvido).toBe(editado);
    expect(resolvido.displayName).toBe('Nome corrigido');
  });

  it('continua valendo depois de a listagem ser relida com objetos novos', () => {
    const relido = [product('1'), product('2'), product('3')];

    const resolvido = resolveSelectedProduct(relido, '2');

    expect(resolvido).not.toBe(DOIS);
    expect(resolvido.id).toBe('2');
  });

  it('nao quebra com lista ausente', () => {
    expect(resolveSelectedProduct(undefined, '2')).toBeNull();
    expect(resolveSelectedProduct(null, '2')).toBeNull();
    expect(resolveSelectedProduct([], '2')).toBeNull();
  });
});
