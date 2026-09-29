import { describe, expect, it } from 'vitest';

import { planReferenceCompletion, referenceCodesToAsk } from './referenceCompletion.js';

/**
 * Complementacao do catalogo pela base guardada: o que e procurado, o que e
 * preenchido e o que e contado. O mapa entra pronto, como a busca em lista o
 * devolve.
 */

const NOW = '2026-10-01T12:00:00.000Z';

function product(fields) {
  return {
    id: `id-${fields.systemCode}`,
    displayName: 'PRODUTO INVENTADO',
    priceInCentavos: 10000,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...fields,
  };
}

const WARDROBE = product({ systemCode: '01620', displayName: 'GUARDA ROUPA INVENTADO 6PTS' });
const STOVE = product({ systemCode: '118114', displayName: 'FOGAO INVENTADO 4 BOCAS', ncm: '73211100' });
const SOFA = product({
  systemCode: '2040',
  displayName: 'SOFA INVENTADO 3 LUGARES',
  ncm: '94016100',
  ean: '7890000000031',
});
const RACK = product({ systemCode: '5001', displayName: 'RACK INVENTADO' });

const BASE = new Map([
  ['01620', { systemCode: '1620', ncm: '94035000', ean: '7890000000017' }],
  ['118114', { systemCode: '118114', ncm: '73211100', ean: '7890000000024' }],
]);

describe('referenceCodesToAsk', () => {
  it('pede so os codigos dos produtos sem NCM ou sem codigo de barras, como estao gravados', () => {
    expect(referenceCodesToAsk([WARDROBE, STOVE, SOFA, RACK])).toEqual(['01620', '118114', '5001']);
  });

  it('nao pede nada quando o catalogo esta completo ou vazio', () => {
    expect(referenceCodesToAsk([SOFA])).toEqual([]);
    expect(referenceCodesToAsk([])).toEqual([]);
  });
});

describe('planReferenceCompletion', () => {
  it('preenche so o campo vazio, com o valor da base, e marca o momento', () => {
    const plan = planReferenceCompletion([WARDROBE, STOVE, SOFA, RACK], BASE, { now: NOW });

    expect(plan.products).toEqual([
      { ...WARDROBE, ncm: '94035000', ean: '7890000000017', updatedAt: NOW },
      { ...STOVE, ean: '7890000000024', updatedAt: NOW },
    ]);
  });

  it('conta o que foi procurado, o que cada campo ganha e o que esta fora da base', () => {
    const { summary } = planReferenceCompletion([WARDROBE, STOVE, SOFA, RACK], BASE, { now: NOW });

    expect(summary).toEqual(
      expect.objectContaining({
        askedCodes: 3,
        outsideReference: 1,
        updatedProducts: 2,
        outsideCatalog: 0,
      }),
    );
    expect(summary.gainedByField.ncm).toBe(1);
    expect(summary.gainedByField.ean).toBe(2);
  });

  it('nao muda nada com a base vazia', () => {
    const plan = planReferenceCompletion([WARDROBE, RACK], new Map(), { now: NOW });

    expect(plan.products).toEqual([]);
    expect(plan.summary).toEqual(
      expect.objectContaining({ askedCodes: 2, outsideReference: 2, updatedProducts: 0 }),
    );
  });

  it('nao troca o NCM que o produto ja tem, mesmo quando a base diz outro', () => {
    const base = new Map([['118114', { systemCode: '118114', ncm: '73211900' }]]);
    const plan = planReferenceCompletion([STOVE], base, { now: NOW });

    expect(plan.products).toEqual([]);
    expect(plan.summary.alreadyComplete).toBe(1);
    expect(plan.summary.filledByField.ncm).toBe(1);
  });
});
