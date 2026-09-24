// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { ProductSchema } from './productSchema.js';

const BASE = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  systemCode: '118789',
  displayName: 'CANTINHO CAFE RUBI',
  priceInCentavos: 85990,
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
};

function ncmErrors(ncm) {
  const result = ProductSchema.safeParse({ ...BASE, ncm });

  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('NCM', () => {
  it('aceita o NCM de oito digitos', () => {
    expect(ProductSchema.parse({ ...BASE, ncm: '94035000' }).ncm).toBe('94035000');
  });

  it('aceita o produto sem NCM', () => {
    expect(ProductSchema.parse(BASE)).not.toHaveProperty('ncm');
  });

  it('recusa sete digitos, nove digitos, letra e ponto', () => {
    for (const ncm of ['9403500', '940350001', '9403500A', '9403.50.00']) {
      expect(ncmErrors(ncm)).toEqual(['NCM deve ter 8 dígitos, sem ponto']);
    }
  });
});

describe('nome da etiqueta dentro do simbolo', () => {
  it('recusa a barra vertical, que separa os campos do simbolo', () => {
    const result = ProductSchema.safeParse({ ...BASE, displayName: 'MESA | CADEIRA' });

    expect(result.success).toBe(false);
    expect(result.error.issues[0]).toMatchObject({
      path: ['displayName'],
      message: 'Nome da etiqueta não pode ter barra vertical (|) nem quebra de linha',
    });
  });

  it('recusa a quebra de linha no meio do nome', () => {
    expect(ProductSchema.safeParse({ ...BASE, displayName: 'MESA\nCADEIRA' }).success).toBe(false);
  });

  it('continua aceitando acento e pontuacao comum', () => {
    expect(ProductSchema.safeParse({ ...BASE, displayName: 'Sofá 3 lugares, 2,10 m - cinza' }).success).toBe(
      true,
    );
  });
});
