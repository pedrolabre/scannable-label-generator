// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { applyDivergenceChoices, planCatalogCompletion } from './catalogCompletion.js';
import { IMPORT_FORMAT_ODS, IMPORT_FORMAT_TXT, createImportRecord } from './importRecord.js';
import { attachProductCandidate } from './productMapping.js';

/**
 * As divergencias do Completar dados: descricao, preco ou NCM preenchidos com
 * valor diferente do arquivo. O calculo so as aponta; quem muda o produto e a
 * escolha, item por item. Os registros passam pela traducao de verdade.
 */

const BEFORE = '2026-09-01T12:00:00.000Z';
const NOW = '2026-10-08T12:00:00.000Z';

const WARDROBE = Object.freeze({
  id: '00000000-0000-4000-8000-000000000001',
  systemCode: '1620',
  displayName: 'GUARDA ROUPA INVENTADO 6PTS',
  description: 'GUARDA ROUPA INVENTADO 6PTS',
  priceInCentavos: 129990,
  ncm: '94035000',
  createdAt: BEFORE,
  updatedAt: BEFORE,
});

const STOVE = Object.freeze({
  id: '00000000-0000-4000-8000-000000000002',
  systemCode: '118114',
  displayName: 'FOGAO INVENTADO',
  priceInCentavos: 89990,
  createdAt: BEFORE,
  updatedAt: BEFORE,
});

function priceRecord(raw, index = 0) {
  return attachProductCandidate(
    createImportRecord({
      fileName: 'tabela.txt',
      fileIndex: 0,
      format: IMPORT_FORMAT_TXT,
      index,
      lineNumber: index + 2,
      raw,
    }),
  );
}

function sheetRecord(raw, index = 0) {
  return attachProductCandidate(
    createImportRecord({
      fileName: 'cadastro.ods',
      fileIndex: 0,
      format: IMPORT_FORMAT_ODS,
      index,
      lineNumber: index + 2,
      raw,
    }),
  );
}

describe('planCatalogCompletion, divergencias', () => {
  it('aponta descricao, preco e NCM diferentes, sem mudar o produto', () => {
    const plan = planCatalogCompletion(
      [WARDROBE],
      [
        priceRecord({
          Codigo: '001620',
          Descricao: 'GUARDA ROUPA INVENTADO 6 PORTAS BRANCO',
          'Preço R$': '1.399,90',
          NCM: '94036000',
        }),
      ],
      { now: NOW },
    );

    expect(plan.products).toEqual([]);
    expect(plan.divergences).toEqual([
      {
        id: `${WARDROBE.id}:description`,
        productId: WARDROBE.id,
        systemCode: '1620',
        displayName: WARDROBE.displayName,
        field: 'description',
        current: 'GUARDA ROUPA INVENTADO 6PTS',
        incoming: 'GUARDA ROUPA INVENTADO 6 PORTAS BRANCO',
      },
      expect.objectContaining({ field: 'priceInCentavos', current: 129990, incoming: 139990 }),
      expect.objectContaining({ field: 'ncm', current: '94035000', incoming: '94036000' }),
    ]);
  });

  it('nao aponta a descricao que so difere nos espacos', () => {
    const { divergences } = planCatalogCompletion(
      [WARDROBE],
      [priceRecord({ Codigo: '1620', Descricao: 'GUARDA  ROUPA INVENTADO   6PTS', 'Preço R$': '1.299,90' })],
    );

    expect(divergences).toEqual([]);
  });

  it('preenche o campo vazio em vez de aponta-lo, e ignora o valor invalido', () => {
    const plan = planCatalogCompletion(
      [STOVE],
      [sheetRecord({ Código: '118114', Descrição: 'FOGAO INVENTADO 4 BOCAS', NCM: '7321110' })],
      { now: NOW },
    );

    expect(plan.products).toEqual([{ ...STOVE, description: 'FOGAO INVENTADO 4 BOCAS', updatedAt: NOW }]);
    expect(plan.divergences).toEqual([]);
  });

  it('so considera o primeiro registro do codigo repetido', () => {
    const { divergences } = planCatalogCompletion(
      [WARDROBE],
      [
        priceRecord({ Codigo: '1620', Descricao: WARDROBE.description, 'Preço R$': '1.299,90' }, 0),
        priceRecord({ Codigo: '01620', Descricao: WARDROBE.description, 'Preço R$': '999,90' }, 1),
      ],
    );

    expect(divergences).toEqual([]);
  });
});

describe('applyDivergenceChoices', () => {
  const divergences = planCatalogCompletion(
    [WARDROBE, STOVE],
    [
      priceRecord({
        Codigo: '1620',
        Descricao: 'GUARDA ROUPA INVENTADO 6 PORTAS COM ESPELHO E GAVETAS DE CORREDICA METALICA',
        'Preço R$': '1.399,90',
      }),
      priceRecord({ Codigo: '118114', Descricao: 'FOGAO INVENTADO', 'Preço R$': '949,90' }, 1),
    ],
  ).divergences;

  const ids = Object.fromEntries(divergences.map((item) => [`${item.systemCode}:${item.field}`, item.id]));

  it('muda so o que foi escolhido e refaz o nome da etiqueta pela descricao nova', () => {
    const { products, summary } = applyDivergenceChoices(
      [WARDROBE, STOVE],
      divergences,
      [ids['1620:description'], ids['118114:priceInCentavos']],
      { now: NOW },
    );

    expect(products).toEqual([
      {
        ...WARDROBE,
        description: 'GUARDA ROUPA INVENTADO 6 PORTAS COM ESPELHO E GAVETAS DE CORREDICA METALICA',
        displayName: 'GUARDA ROUPA INVENTADO 6 PORTAS COM ESPELHO E GAVETAS DE',
        updatedAt: NOW,
      },
      { ...STOVE, priceInCentavos: 94990, updatedAt: NOW },
    ]);
    expect(summary).toEqual({ applied: 2, stale: 0, updatedProducts: 2 });
  });

  it('junta duas escolhas do mesmo produto numa gravacao so', () => {
    const { products } = applyDivergenceChoices(
      [WARDROBE],
      divergences,
      [ids['1620:description'], ids['1620:priceInCentavos']],
      { now: NOW },
    );

    expect(products).toHaveLength(1);
    expect(products[0].priceInCentavos).toBe(139990);
    expect(products[0].description).toMatch(/^GUARDA ROUPA INVENTADO 6 PORTAS/);
  });

  it('nao muda nada sem escolha', () => {
    expect(applyDivergenceChoices([WARDROBE, STOVE], divergences, []).products).toEqual([]);
  });

  it('conta como desatualizada a escolha cujo produto mudou ou saiu do catalogo', () => {
    const repriced = { ...STOVE, priceInCentavos: 92990 };
    const { products, summary } = applyDivergenceChoices(
      [repriced],
      divergences,
      [ids['1620:priceInCentavos'], ids['118114:priceInCentavos']],
      { now: NOW },
    );

    expect(products).toEqual([]);
    expect(summary).toEqual({ applied: 0, stale: 2, updatedProducts: 0 });
  });

  it('mantem o nome da etiqueta quando o da descricao seria recusado pelo contrato', () => {
    const [divergence] = planCatalogCompletion(
      [WARDROBE],
      [priceRecord({ Codigo: '1620', Descricao: 'GUARDA ROUPA | INVENTADO', 'Preço R$': '1.299,90' })],
    ).divergences;

    const { products } = applyDivergenceChoices([WARDROBE], [divergence], [divergence.id], { now: NOW });

    expect(products[0].description).toBe('GUARDA ROUPA | INVENTADO');
    expect(products[0].displayName).toBe(WARDROBE.displayName);
  });
});
