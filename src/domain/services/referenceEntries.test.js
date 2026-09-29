// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { ReferenceEntrySchema } from '../schemas/referenceEntrySchema.js';

import { HEADER_ROW, emptyCell, productRow, row, singleSheetOds, textCell } from './odsFixtures.js';
import { parseOdsFile } from './odsParser.js';
import { attachProductCandidate } from './productMapping.js';
import { buildReferenceEntries } from './referenceEntries.js';

/**
 * As linhas da base de referencia a partir da planilha cadastral. A planilha e
 * montada na hora, passa pelo leitor e pela traducao de verdade, e o que cada
 * campo aceita e o mesmo do produto.
 */

const ORIGIN = { fileName: 'cadastro-inventado.ods', fileIndex: 0 };

async function entriesOf(rows) {
  const records = await parseOdsFile(await singleSheetOds([HEADER_ROW, ...rows]), ORIGIN);

  return buildReferenceEntries(records.map(attachProductCandidate));
}

// Linha com o codigo como texto, para o codigo impresso com zero a esquerda.
function textCodeRow({ code, description, barcode = '', ncm }) {
  return row([
    textCell(code),
    textCell(description),
    barcode === '' ? emptyCell() : textCell(barcode),
    ncm === '' ? emptyCell() : textCell(ncm),
  ]);
}

const WARDROBE = { code: 1620, description: 'GUARDA ROUPA INVENTADO 6 PORTAS', barcode: '7890000000017', ncm: '94035000' };
const STOVE = { code: 118114, description: 'FOGAO INVENTADO 4 BOCAS', ncm: '73211100' };

describe('buildReferenceEntries, valores aceitos', () => {
  it('guarda o NCM e o codigo de barras validos com o codigo como veio e o comparavel', async () => {
    const { entries, summary } = await entriesOf([productRow(WARDROBE), productRow(STOVE)]);

    expect(entries).toEqual([
      { comparableCode: '1620', systemCode: '1620', ncm: '94035000', ean: '7890000000017' },
      { comparableCode: '118114', systemCode: '118114', ncm: '73211100' },
    ]);
    expect(summary).toEqual({
      recordCount: 2,
      entryCount: 2,
      withNcm: 2,
      withEan: 1,
      invalidNcm: 0,
      invalidEan: 0,
      unusable: 0,
      repeated: 0,
    });
  });

  it('guarda so o codigo, o NCM e o codigo de barras, sem a descricao da planilha', async () => {
    const { entries } = await entriesOf([productRow(WARDROBE)]);

    expect(Object.keys(entries[0]).sort()).toEqual(['comparableCode', 'ean', 'ncm', 'systemCode']);
    expect(JSON.stringify(entries)).not.toContain('GUARDA ROUPA');
  });

  it('produz linhas que passam pelo contrato da base', async () => {
    const { entries } = await entriesOf([productRow(WARDROBE), productRow(STOVE)]);

    entries.forEach((entry) => {
      expect(ReferenceEntrySchema.safeParse({ ...entry, loadedAt: '2026-09-30T12:00:00.000Z' }).success).toBe(true);
    });
  });
});

describe('buildReferenceEntries, valores fora do contrato', () => {
  it('deixa fora o NCM de 7 digitos e guarda o NCM com ponto sem o ponto', async () => {
    const { entries, summary } = await entriesOf([
      productRow({ code: 5001, description: 'RACK INVENTADO', ncm: '9403500' }),
      productRow({ code: 5002, description: 'MESA INVENTADA', ncm: '9403.50.00' }),
    ]);

    expect(entries).toEqual([{ comparableCode: '5002', systemCode: '5002', ncm: '94035000' }]);
    expect(summary.invalidNcm).toBe(1);
    expect(summary.unusable).toBe(1);
    expect(summary.withNcm).toBe(1);
  });

  it('deixa fora o codigo de barras fora do padrao e guarda o NCM da mesma linha', async () => {
    const { entries, summary } = await entriesOf([
      productRow({ code: 6001, description: 'GELADEIRA INVENTADA', barcode: '78900000000171', ncm: '84182100' }),
      productRow({ code: 6002, description: 'CAMA INVENTADA', barcode: '789000000001712', ncm: '94035000' }),
    ]);

    expect(entries).toEqual([
      { comparableCode: '6001', systemCode: '6001', ncm: '84182100', ean: '78900000000171' },
      { comparableCode: '6002', systemCode: '6002', ncm: '94035000' },
    ]);
    expect(summary.invalidEan).toBe(1);
    expect(summary.withEan).toBe(1);
    expect(summary.entryCount).toBe(2);
  });

  it('guarda pelo codigo de barras a linha que so tem o NCM invalido', async () => {
    const { entries, summary } = await entriesOf([
      productRow({ code: 7001, description: 'SOFA INVENTADO', barcode: '7890000000024', ncm: '9401610' }),
    ]);

    expect(entries).toEqual([{ comparableCode: '7001', systemCode: '7001', ean: '7890000000024' }]);
    expect(summary.invalidNcm).toBe(1);
    expect(summary.unusable).toBe(0);
  });

  it('deixa fora a linha sem NCM e sem codigo de barras aproveitaveis', async () => {
    const { entries, summary } = await entriesOf([
      textCodeRow({ code: '8001', description: 'POLTRONA INVENTADA', ncm: '' }),
      productRow({ code: 8002, description: 'ARMARIO INVENTADO', barcode: '123', ncm: '94036' }),
      productRow(STOVE),
    ]);

    expect(entries.map((entry) => entry.systemCode)).toEqual(['118114']);
    expect(summary).toEqual(
      expect.objectContaining({ recordCount: 3, entryCount: 1, unusable: 2, invalidNcm: 1, invalidEan: 1 }),
    );
  });
});

describe('buildReferenceEntries, codigo repetido', () => {
  it('fica com a primeira linha quando o mesmo codigo vem com e sem zeros a esquerda', async () => {
    const { entries, summary } = await entriesOf([
      textCodeRow({ code: '01620', description: 'GUARDA ROUPA INVENTADO', ncm: '94035000' }),
      textCodeRow({ code: '1620', description: 'GUARDA ROUPA INVENTADO', barcode: '7890000000017', ncm: '94036000' }),
    ]);

    expect(entries).toEqual([{ comparableCode: '1620', systemCode: '01620', ncm: '94035000' }]);
    expect(summary.repeated).toBe(1);
  });

  it('fica com a primeira linha mesmo quando ela nao tem dado aproveitavel', async () => {
    const { entries, summary } = await entriesOf([
      textCodeRow({ code: '1620', description: 'GUARDA ROUPA INVENTADO', ncm: '9403500' }),
      textCodeRow({ code: '001620', description: 'GUARDA ROUPA INVENTADO', ncm: '94035000' }),
    ]);

    expect(entries).toEqual([]);
    expect(summary).toEqual(expect.objectContaining({ unusable: 1, repeated: 1, invalidNcm: 1 }));
  });

  it('compara inteiro o codigo com letra ou hifen', async () => {
    const { entries } = await entriesOf([
      textCodeRow({ code: 'MOV-01', description: 'ESTANTE INVENTADA', ncm: '94036000' }),
      textCodeRow({ code: 'MOV-1', description: 'ESTANTE INVENTADA', ncm: '94036000' }),
    ]);

    expect(entries.map((entry) => entry.comparableCode)).toEqual(['MOV-01', 'MOV-1']);
  });
});
