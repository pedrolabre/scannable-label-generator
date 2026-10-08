// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  IMPORT_FORMAT_CSV,
  IMPORT_FORMAT_ODS,
  IMPORT_FORMAT_TXT,
  IMPORT_FORMAT_XML,
  createImportRecord,
} from './importRecord.js';
import { attachProductCandidate } from './productMapping.js';
import { planReferenceMerge, selectReferenceRecords } from './referenceEntries.js';

/**
 * De que arquivos a base e montada, e o que a carga que atualiza a base faz com
 * cada linha guardada. Os registros passam pela traducao de verdade.
 */

function record(fileIndex, format, raw, index = 0) {
  return attachProductCandidate(
    createImportRecord({
      fileName: `arquivo-${fileIndex}.${format}`,
      fileIndex,
      format,
      index,
      lineNumber: format === IMPORT_FORMAT_CSV ? null : index + 2,
      raw,
    }),
  );
}

describe('selectReferenceRecords', () => {
  it('fica com os arquivos em colunas que trazem NCM ou codigo de barras, inteiros', () => {
    const sheet = [
      record(0, IMPORT_FORMAT_ODS, { Código: '1620', NCM: '94035000' }, 0),
      record(0, IMPORT_FORMAT_ODS, { Código: '5001', NCM: '' }, 1),
    ];
    const csv = [record(1, IMPORT_FORMAT_CSV, { codigo: '118114', 'Cód. Barras': '7890000000024' })];
    const tabbed = [record(2, IMPORT_FORMAT_TXT, { Código: '2040', NCM: '9401610' })];

    expect(selectReferenceRecords([...sheet, ...csv, ...tabbed])).toEqual([...sheet, ...csv, ...tabbed]);
  });

  it('deixa de fora o relatorio sem NCM nem codigo de barras e a nota fiscal', () => {
    const report = record(0, IMPORT_FORMAT_TXT, { Codigo: '001620', Descricao: 'GUARDA ROUPA INVENTADO' });
    const note = record(1, IMPORT_FORMAT_XML, { cProd: '1620', xProd: 'GUARDA ROUPA', NCM: '94035000' });

    expect(selectReferenceRecords([report, note])).toEqual([]);
  });
});

describe('planReferenceMerge', () => {
  const stored = new Map([
    ['1620', { comparableCode: '1620', systemCode: '1620', ncm: '94035000', ean: '7890000000017' }],
    ['118114', { comparableCode: '118114', systemCode: '118114', ncm: '73211100' }],
  ]);

  it('conta novos, atualizados e iguais, e o campo ausente do arquivo fica como estava', () => {
    const { entries, summary } = planReferenceMerge(
      [
        { comparableCode: '1620', systemCode: '01620', ncm: '94036000' },
        { comparableCode: '118114', systemCode: '118114', ncm: '73211100' },
        { comparableCode: '5001', systemCode: '5001', ean: '7890000000031' },
      ],
      stored,
    );

    expect(entries).toEqual([
      { comparableCode: '1620', systemCode: '01620', ncm: '94036000', ean: '7890000000017' },
      { comparableCode: '118114', systemCode: '118114', ncm: '73211100' },
      { comparableCode: '5001', systemCode: '5001', ean: '7890000000031' },
    ]);
    expect(summary).toEqual({ added: 1, updated: 1, unchanged: 1 });
  });

  it('com a base vazia, tudo e novo', () => {
    const { summary } = planReferenceMerge(
      [{ comparableCode: '1620', systemCode: '1620', ncm: '94035000' }],
      new Map(),
    );

    expect(summary).toEqual({ added: 1, updated: 0, unchanged: 0 });
  });
});
