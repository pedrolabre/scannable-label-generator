import { describe, expect, it } from 'vitest';

import {
  IMPORT_FILE_PARSED,
  IMPORT_FILE_REJECTED,
  parseImportFiles,
  summarizeImportFiles,
} from './importService.js';

function fileFrom(name, content) {
  return new File([content], name, { type: 'text/plain' });
}

const VALID_NOTE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe versao="4.00">
      <det nItem="1">
        <prod>
          <cProd>INV-1</cProd>
          <xProd>PRODUTO INVENTADO</xProd>
          <vUnCom>9.9000</vUnCom>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

const CSV_CONTENT = [
  'systemCode,displayName,price',
  'INV-1,Produto inventado um,12.50',
  'INV-2,Produto inventado dois,3.99',
].join('\n');

describe('parseImportFiles', () => {
  it('le CSV, JSON e XML no mesmo lote e reune os registros', async () => {
    const { records, files } = await parseImportFiles([
      fileFrom('planilha.csv', CSV_CONTENT),
      fileFrom('lista.json', JSON.stringify([{ systemCode: 'INV-3', price: 1 }])),
      fileFrom('nota.xml', VALID_NOTE),
    ]);

    expect(files.map((file) => file.status)).toEqual([
      IMPORT_FILE_PARSED,
      IMPORT_FILE_PARSED,
      IMPORT_FILE_PARSED,
    ]);
    expect(files.map((file) => file.recordCount)).toEqual([2, 1, 1]);
    expect(records).toHaveLength(4);
    expect(records.map((record) => record.source.format)).toEqual(['csv', 'csv', 'json', 'xml']);
  });

  it('entrega cada registro ja traduzido para os campos do produto', async () => {
    const { records } = await parseImportFiles([
      fileFrom('planilha.csv', CSV_CONTENT),
      fileFrom('nota.xml', VALID_NOTE),
    ]);

    expect(records[0].candidate).toEqual({
      systemCode: 'INV-1',
      displayName: 'Produto inventado um',
      priceInCentavos: 1250,
    });
    expect(records[2].candidate).toEqual({
      systemCode: 'INV-1',
      displayName: 'PRODUTO INVENTADO',
      description: 'PRODUTO INVENTADO',
      priceInCentavos: 990,
    });
    expect(records.every((record) => Array.isArray(record.candidateIssues))).toBe(true);
  });

  it('mantem as chaves do cabecalho do CSV mesmo em linha curta', async () => {
    const { records } = await parseImportFiles([
      fileFrom('planilha.csv', ['a,b,c', '1,2'].join('\n')),
    ]);

    expect(records[0].raw).toEqual({ a: '1', b: '2', c: '' });
  });

  it('apara o espaco em volta do nome da coluna do CSV', async () => {
    const { records } = await parseImportFiles([
      fileFrom('planilha.csv', [' systemCode , displayName ', 'INV-9,Produto inventado'].join('\n')),
    ]);

    expect(Object.keys(records[0].raw)).toEqual(['systemCode', 'displayName']);
    expect(records[0].raw.systemCode).toBe('INV-9');
  });

  it('aceita a lista de registros dentro de uma propriedade do JSON', async () => {
    const { records } = await parseImportFiles([
      fileFrom('lista.json', JSON.stringify({ produtos: [{ systemCode: 'INV-4' }] })),
    ]);

    expect(records).toHaveLength(1);
    expect(records[0].raw.systemCode).toBe('INV-4');
  });

  it('recusa um arquivo sem interromper a leitura dos demais', async () => {
    const { records, files } = await parseImportFiles([
      fileFrom('quebrada.xml', '<nfeProc><NFe>'),
      fileFrom('nota.xml', VALID_NOTE),
      fileFrom('lista.json', '{ isto nao e json'),
      fileFrom('outra-nota.xml', VALID_NOTE),
    ]);

    expect(files.map((file) => file.status)).toEqual([
      IMPORT_FILE_REJECTED,
      IMPORT_FILE_PARSED,
      IMPORT_FILE_REJECTED,
      IMPORT_FILE_PARSED,
    ]);
    expect(records).toHaveLength(2);
    expect(files[0].error).toMatch(/malformado/);
    expect(files[2].error).toMatch(/malformado/);
  });

  it('recusa XML que nao e de NFC-e com o motivo no proprio arquivo', async () => {
    const { records, files } = await parseImportFiles([
      fileFrom('catalogo.xml', '<catalogo><produto/></catalogo>'),
      fileFrom('nota.xml', VALID_NOTE),
    ]);

    expect(files[0].status).toBe(IMPORT_FILE_REJECTED);
    expect(files[0].error).toMatch(/nfeProc/);
    expect(records).toHaveLength(1);
  });

  it('recusa extensao fora das tres aceitas', async () => {
    const { files } = await parseImportFiles([fileFrom('planilha.xlsx', 'qualquer coisa')]);

    expect(files[0].status).toBe(IMPORT_FILE_REJECTED);
    expect(files[0].error).toMatch(/Formato não aceito/);
    expect(files[0].format).toBeNull();
  });

  it('avisa cada arquivo assim que ele termina, na ordem da selecao', async () => {
    const settled = [];

    await parseImportFiles(
      [fileFrom('nota.xml', VALID_NOTE), fileFrom('quebrada.xml', '<nfeProc>')],
      { onFileSettled: (file) => settled.push(file.fileName) },
    );

    expect(settled).toEqual(['nota.xml', 'quebrada.xml']);
  });

  it('reune um arquivo com centenas de milhares de registros', async () => {
    const many = Array.from({ length: 200000 }, (_, index) => ({ systemCode: `INV-${index}` }));

    const { records, files } = await parseImportFiles([
      fileFrom('grande.json', JSON.stringify(many)),
    ]);

    expect(files[0].status).toBe(IMPORT_FILE_PARSED);
    expect(records).toHaveLength(200000);
  });

  it('devolve lote vazio quando nada foi escolhido', async () => {
    await expect(parseImportFiles([])).resolves.toEqual({ records: [], files: [] });
  });
});

describe('summarizeImportFiles', () => {
  it('separa aceitos de recusados e soma os registros', async () => {
    const { files } = await parseImportFiles([
      fileFrom('planilha.csv', CSV_CONTENT),
      fileFrom('quebrada.xml', '<nfeProc><NFe>'),
      fileFrom('nota.xml', VALID_NOTE),
    ]);

    expect(summarizeImportFiles(files)).toEqual({
      parsedFiles: 2,
      rejectedFiles: 1,
      recordCount: 3,
    });
  });
});
