import { describe, expect, it } from 'vitest';

import { createImportRecord, describeImportOrigin, toRawText } from './importRecord.js';

function recordFrom(format, extra = {}) {
  return createImportRecord({
    fileName: 'lote.' + format,
    fileIndex: 0,
    format,
    index: 0,
    raw: {},
    ...extra,
  });
}

describe('describeImportOrigin', () => {
  it('conta o cabecalho na numeracao de linha do CSV', () => {
    expect(describeImportOrigin(recordFrom('csv', { index: 0 }))).toBe('lote.csv, linha 2');
    expect(describeImportOrigin(recordFrom('csv', { index: 11 }))).toBe('lote.csv, linha 13');
  });

  it('usa o numero do item declarado pelo XML quando ele existe', () => {
    expect(describeImportOrigin(recordFrom('xml', { index: 0, itemNumber: '7' }))).toBe(
      'lote.xml, item 7',
    );
    expect(describeImportOrigin(recordFrom('xml', { index: 2 }))).toBe('lote.xml, item 3');
  });

  it('numera os registros do JSON a partir de um', () => {
    expect(describeImportOrigin(recordFrom('json', { index: 4 }))).toBe('lote.json, registro 5');
  });
});

describe('createImportRecord', () => {
  it('distingue registros na mesma posicao de arquivos diferentes', () => {
    const first = createImportRecord({
      fileName: 'nota.xml',
      fileIndex: 0,
      format: 'xml',
      index: 0,
      raw: {},
    });
    const second = createImportRecord({
      fileName: 'nota.xml',
      fileIndex: 3,
      format: 'xml',
      index: 0,
      raw: {},
    });

    expect(first.recordId).not.toBe(second.recordId);
  });
});

describe('toRawText', () => {
  it('reduz todo valor a texto, sem perder estrutura aninhada', () => {
    expect(toRawText('  12,50 ')).toBe('12,50');
    expect(toRawText(12.5)).toBe('12.5');
    expect(toRawText(null)).toBe('');
    expect(toRawText(undefined)).toBe('');
    expect(toRawText(false)).toBe('false');
    expect(toRawText({ unidade: 'UN' })).toBe('{"unidade":"UN"}');
  });
});
