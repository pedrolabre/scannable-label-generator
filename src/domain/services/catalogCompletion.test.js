// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { ProductSchema } from '../schemas/productSchema.js';

import { comparableCode, planCatalogCompletion } from './catalogCompletion.js';
import { IMPORT_FORMAT_ODS, IMPORT_FORMAT_TXT, createImportRecord } from './importRecord.js';
import { attachProductCandidate } from './productMapping.js';

/**
 * O que a complementacao muda: quem ganha qual campo, o que fica como esta e o
 * que e contado, sem armazenamento nenhum. Os registros passam pela traducao de
 * verdade, entao o que cada campo aceita e o mesmo do importador.
 */

const BEFORE = '2026-09-01T12:00:00.000Z';
const NOW = '2026-09-30T12:00:00.000Z';

let nextId = 0;

function product(overrides = {}) {
  nextId += 1;

  return {
    id: `00000000-0000-4000-8000-${String(nextId).padStart(12, '0')}`,
    systemCode: '1620',
    displayName: 'GUARDA ROUPA INVENTADO',
    priceInCentavos: 129990,
    createdAt: BEFORE,
    updatedAt: BEFORE,
    ...overrides,
  };
}

function sheetRecord(raw, index = 0) {
  return attachProductCandidate(
    createImportRecord({
      fileName: 'cadastro.ods',
      fileIndex: 0,
      format: IMPORT_FORMAT_ODS,
      index,
      lineNumber: index + 2,
      raw: { Código: '', Descrição: '', 'Cód. Barras': '', NCM: '', ...raw },
    }),
  );
}

function reportRecord(raw, index = 0) {
  return attachProductCandidate(
    createImportRecord({
      fileName: 'saldo.TXT',
      fileIndex: 0,
      format: IMPORT_FORMAT_TXT,
      index,
      lineNumber: index + 10,
      raw,
    }),
  );
}

function plan(products, records) {
  return planCatalogCompletion(products, records, { now: NOW });
}

describe('comparableCode', () => {
  it('tira os zeros a esquerda so do codigo numerico', () => {
    expect(comparableCode('001620')).toBe('1620');
    expect(comparableCode('1620')).toBe('1620');
    expect(comparableCode('000')).toBe('0');
    expect(comparableCode('0A-12')).toBe('0A-12');
  });
});

describe('planCatalogCompletion, campos', () => {
  it('preenche o campo vazio com o valor do arquivo', () => {
    const wardrobe = product();
    const { products } = plan([wardrobe], [sheetRecord({ Código: '1620', NCM: '94035000' })]);

    expect(products).toEqual([{ ...wardrobe, ncm: '94035000', updatedAt: NOW }]);
  });

  it('deixa o campo preenchido como esta, mesmo com outro valor no arquivo', () => {
    const wardrobe = product({ ncm: '94036000', description: 'DESCRICAO GRAVADA' });
    const { products, summary } = plan(
      [wardrobe],
      [sheetRecord({ Código: '1620', Descrição: 'DESCRICAO DO ARQUIVO', NCM: '94035000' })],
    );

    expect(products).toEqual([]);
    expect(summary.filledByField).toEqual(expect.objectContaining({ ncm: 1, description: 1 }));
    expect(summary.alreadyComplete).toBe(1);
  });

  it('preenche todo campo opcional vazio que o arquivo trouxer', () => {
    const wardrobe = product();
    const [changed] = plan(
      [wardrobe],
      [
        sheetRecord({
          Código: '1620',
          Descrição: 'GUARDA ROUPA INVENTADO 6 PORTAS BRANCO',
          'Cód. Barras': '7890000000017',
          NCM: '9403.50.00',
        }),
      ],
    ).products;

    expect(changed).toEqual({
      ...wardrobe,
      description: 'GUARDA ROUPA INVENTADO 6 PORTAS BRANCO',
      ean: '7890000000017',
      ncm: '94035000',
      updatedAt: NOW,
    });
    expect(ProductSchema.safeParse(changed).success).toBe(true);
  });

  it('completa a categoria pelo grupo do saldo de estoque', () => {
    const { products } = plan(
      [product()],
      [reportRecord({ Codigo: '001620', Alternativo: '15409.8', Descricao: 'X', UN: 'UN', 'Est. Loja': '1,00', Grupo: '21-MOVEIS' })],
    );

    expect(products[0].category).toBe('21-MOVEIS');
  });

  it('nunca troca nome, preco nem codigo, mesmo quando o arquivo os traz', () => {
    const wardrobe = product();
    const [changed] = plan(
      [wardrobe],
      [reportRecord({ Codigo: '01620', Descricao: 'OUTRO NOME', 'Preço R$': '1,00' })],
    ).products;

    expect(changed.displayName).toBe(wardrobe.displayName);
    expect(changed.priceInCentavos).toBe(wardrobe.priceInCentavos);
    expect(changed.systemCode).toBe('1620');
    expect(changed.description).toBe('OUTRO NOME');
  });
});

describe('planCatalogCompletion, valores fora do contrato', () => {
  it('ignora e conta o NCM de sete digitos e o codigo de barras fora do padrao', () => {
    const { products, summary } = plan(
      [product(), product({ systemCode: '11' })],
      [
        sheetRecord({ Código: '1620', NCM: '3909409' }),
        sheetRecord({ Código: '11', 'Cód. Barras': '4CJ1066CR3/671', NCM: '94036000' }, 1),
      ],
    );

    expect(products.map((changed) => [changed.systemCode, changed.ncm, changed.ean])).toEqual([
      ['11', '94036000', undefined],
    ]);
    expect(summary.invalidByField).toEqual(expect.objectContaining({ ncm: 1, ean: 1 }));
    expect(summary.alreadyComplete).toBe(1);
  });

  it('ignora e conta a descricao maior que o contrato aceita', () => {
    const { products, summary } = plan(
      [product()],
      [sheetRecord({ Código: '1620', Descrição: 'D'.repeat(121) })],
    );

    expect(products).toEqual([]);
    expect(summary.invalidByField.description).toBe(1);
  });
});

describe('planCatalogCompletion, codigos', () => {
  it('encontra o produto pelo codigo sem os zeros a esquerda, nos dois sentidos', () => {
    const printed = product({ systemCode: '001620' });
    const plain = product({ systemCode: '118114' });
    const { products } = plan(
      [printed, plain],
      [sheetRecord({ Código: '1620', NCM: '94035000' }), sheetRecord({ Código: '0118114', NCM: '94016100' }, 1)],
    );

    expect(products.map((changed) => [changed.systemCode, changed.ncm])).toEqual([
      ['001620', '94035000'],
      ['118114', '94016100'],
    ]);
  });

  it('prefere o codigo inteiro quando ele existe no catalogo', () => {
    const exact = product({ systemCode: '01620' });
    const other = product({ systemCode: '1620' });
    const { products } = plan([exact, other], [sheetRecord({ Código: '1620', NCM: '94035000' })]);

    expect(products.map((changed) => changed.id)).toEqual([other.id]);
  });

  it('ignora e conta o codigo que aponta para mais de um produto sem os zeros', () => {
    const { products, summary } = plan(
      [product({ systemCode: '01620' }), product({ systemCode: '001620' })],
      [sheetRecord({ Código: '1620', NCM: '94035000' })],
    );

    expect(products).toEqual([]);
    expect(summary.ambiguousCodes).toBe(1);
  });

  it('compara o codigo com letra ou hifen so inteiro', () => {
    const { summary } = plan(
      [product({ systemCode: 'MOV-12' })],
      [sheetRecord({ Código: '0MOV-12', NCM: '94035000' })],
    );

    expect(summary.outsideCatalog).toBe(1);
  });

  it('ignora e conta o codigo fora do catalogo, sem criar produto', () => {
    const catalog = [product()];
    const { products, summary } = plan(catalog, [sheetRecord({ Código: '999999', NCM: '94035000' })]);

    expect(products).toEqual([]);
    expect(summary.outsideCatalog).toBe(1);
  });

  it('usa so a primeira vez do codigo repetido no arquivo, com ou sem zeros', () => {
    const { products, summary } = plan(
      [product()],
      [
        sheetRecord({ Código: '1620', NCM: '94035000' }),
        sheetRecord({ Código: '01620', NCM: '94036000', 'Cód. Barras': '7890000000017' }, 1),
      ],
    );

    expect(products[0].ncm).toBe('94035000');
    expect(products[0].ean).toBeUndefined();
    expect(summary.repeatedInFile).toBe(1);
  });
});

describe('planCatalogCompletion, resumo', () => {
  it('conta cada caso e devolve so os produtos que mudaram, com updatedAt novo so neles', () => {
    const noNcm = product({ systemCode: '1620' });
    const complete = product({ systemCode: '11', ncm: '94036000', ean: '7890000000024' });
    const untouched = product({ systemCode: '555' });

    const { products, summary } = plan(
      [noNcm, complete, untouched],
      [
        sheetRecord({ Código: '1620', 'Cód. Barras': '7890000000017', NCM: '94035000' }),
        sheetRecord({ Código: '11', 'Cód. Barras': '7890000000031', NCM: '94036000' }, 1),
        sheetRecord({ Código: '404', NCM: '94035000' }, 2),
        sheetRecord({ Código: '01620', NCM: '94035000' }, 3),
      ],
    );

    expect(products.map((changed) => changed.id)).toEqual([noNcm.id]);
    expect(products[0].updatedAt).toBe(NOW);
    expect(complete.updatedAt).toBe(BEFORE);
    expect(untouched.updatedAt).toBe(BEFORE);

    expect(summary).toEqual({
      recordCount: 4,
      updatedProducts: 1,
      alreadyComplete: 1,
      outsideCatalog: 1,
      ambiguousCodes: 0,
      repeatedInFile: 1,
      gainedByField: { description: 0, ean: 1, ncm: 1, category: 0, notes: 0 },
      filledByField: { description: 0, ean: 1, ncm: 1, category: 0, notes: 0 },
      invalidByField: { description: 0, ean: 0, ncm: 0, category: 0, notes: 0 },
    });
  });

  it('nao muda o catalogo recebido', () => {
    const wardrobe = product();
    const copy = { ...wardrobe };

    plan([wardrobe], [sheetRecord({ Código: '1620', NCM: '94035000' })]);

    expect(wardrobe).toEqual(copy);
  });

  it('nao muda nada num catalogo vazio', () => {
    const { products, summary } = plan([], [sheetRecord({ Código: '1620', NCM: '94035000' })]);

    expect(products).toEqual([]);
    expect(summary.outsideCatalog).toBe(1);
  });
});
