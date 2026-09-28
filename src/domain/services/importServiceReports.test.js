import { describe, expect, it } from 'vitest';

import {
  ACCEPTED_FILE_EXTENSIONS,
  COMPLETION_FILE_EXTENSIONS,
  IMPORT_FILE_PARSED,
  IMPORT_FILE_REJECTED,
  parseImportFiles,
} from './importService.js';
import { validateCandidate } from './importValidation.js';
import { bytesOf, footer, priceHeader, priceRow, stockHeader, stockRow } from './txtReportFixtures.js';

/**
 * O relatorio em texto do ERP na entrada do importador, junto dos formatos que
 * ja existiam. O ambiente e o de DOM porque a nota fiscal do mesmo lote usa o
 * `DOMParser` do navegador.
 */

const PRICE_REPORT = bytesOf([
  ...priceHeader(1),
  priceRow({ code: '118114', description: 'SOFA INVENTADO 3 LUGARES', price: '1.234,56' }),
  priceRow({ code: '01620', description: 'GUARDA ROUPA INVENTADO 6PTS', price: '29,90' }),
  ...footer(2),
]);

const STOCK_REPORT = bytesOf([
  ...stockHeader(1),
  'Grupo: 21-MOVEIS',
  stockRow({ code: '001620', description: 'GUARDA ROUPA INVENTADO 6PTS' }),
  ...footer(1),
]);

const VALID_NOTE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe versao="4.00">
      <det nItem="1">
        <prod>
          <cProd>INV-1</cProd>
          <xProd>ESTANTE INVENTADA</xProd>
          <vUnCom>9.9000</vUnCom>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

function fileFrom(name, content) {
  return new File([content], name, { type: 'application/octet-stream' });
}

describe('extensoes de cada caminho', () => {
  it('importa produtos de planilha, lista, nota fiscal e relatorio em texto', () => {
    expect(ACCEPTED_FILE_EXTENSIONS).toEqual(['.csv', '.json', '.xml', '.txt']);
  });

  it('completa o catalogo com os mesmos formatos e tambem a planilha OpenDocument', () => {
    expect(COMPLETION_FILE_EXTENSIONS).toEqual(['.csv', '.json', '.xml', '.txt', '.ods']);
  });
});

describe('parseImportFiles, relatorio em texto do ERP', () => {
  it('le o relatorio como bytes, com o formato e a linha de cada registro', async () => {
    const { records, files } = await parseImportFiles([fileFrom('tabela.txt', PRICE_REPORT)]);

    expect(files).toEqual([
      expect.objectContaining({ status: IMPORT_FILE_PARSED, format: 'txt', recordCount: 2 }),
    ]);
    expect(records.map((record) => record.source.format)).toEqual(['txt', 'txt']);
    expect(records.map((record) => record.candidate.priceInCentavos)).toEqual([123456, 2990]);
    expect(records[1].candidate.systemCode).toBe('01620');
  });

  it('aceita a extensao em maiusculas', async () => {
    const { files } = await parseImportFiles([fileFrom('TABELA.TXT', PRICE_REPORT)]);

    expect(files[0]).toEqual(expect.objectContaining({ status: IMPORT_FILE_PARSED, format: 'txt' }));
  });

  it('reune o relatorio com CSV, JSON e XML no mesmo lote, cada arquivo no seu formato', async () => {
    const { records, files } = await parseImportFiles([
      fileFrom('planilha.csv', 'codigo,nome,preco\nINV-2,MESA INVENTADA,"10,00"\n'),
      fileFrom('tabela.TXT', PRICE_REPORT),
      fileFrom('lista.json', JSON.stringify([{ systemCode: 'INV-3', displayName: 'CADEIRA', price: '5,00' }])),
      fileFrom('nota.xml', VALID_NOTE),
    ]);

    expect(files.map((file) => [file.format, file.status])).toEqual([
      ['csv', IMPORT_FILE_PARSED],
      ['txt', IMPORT_FILE_PARSED],
      ['json', IMPORT_FILE_PARSED],
      ['xml', IMPORT_FILE_PARSED],
    ]);
    expect(records.map((record) => record.candidate.systemCode)).toEqual([
      'INV-2',
      '118114',
      '01620',
      'INV-3',
      'INV-1',
    ]);
  });

  it('recusa o texto que nao e relatorio do ERP com a frase do leitor, sem parar o lote', async () => {
    const { records, files } = await parseImportFiles([
      fileFrom('anotacoes.txt', 'lista de compras\nnada de relatorio aqui\n'),
      fileFrom('tabela.txt', PRICE_REPORT),
    ]);

    expect(files[0].status).toBe(IMPORT_FILE_REJECTED);
    expect(files[0].error).toMatch(/^Relatório em texto não reconhecido/);
    expect(files[1].status).toBe(IMPORT_FILE_PARSED);
    expect(records).toHaveLength(2);
  });

  it('leva o saldo de estoque ate a revisao, que recusa o registro pela falta de preco', async () => {
    const { records, files } = await parseImportFiles([fileFrom('saldo.TXT', STOCK_REPORT)]);
    const { success, fieldErrors } = validateCandidate(records[0].candidate);

    expect(files[0].status).toBe(IMPORT_FILE_PARSED);
    expect(records[0].candidate.category).toBe('21-MOVEIS');
    expect(success).toBe(false);
    expect(fieldErrors).toEqual({ priceInCentavos: 'Informe um preço válido. Ex.: 12,50' });
  });
});

describe('parseImportFiles, planilha OpenDocument na importacao de produtos', () => {
  it('recusa o .ods como formato nao aceito, com a lista de extensoes deste caminho', async () => {
    const { records, files } = await parseImportFiles([
      fileFrom('cadastro.ods', 'qualquer coisa'),
      fileFrom('tabela.txt', PRICE_REPORT),
    ]);

    expect(files[0]).toEqual(
      expect.objectContaining({
        status: IMPORT_FILE_REJECTED,
        format: null,
        error: 'Formato não aceito. Escolha arquivos .csv, .json, .xml, .txt.',
      }),
    );
    expect(records).toHaveLength(2);
  });

  it('aceita o relatorio em texto tambem no caminho de completar', async () => {
    const { files } = await parseImportFiles([fileFrom('tabela.txt', PRICE_REPORT)], {
      acceptedExtensions: COMPLETION_FILE_EXTENSIONS,
    });

    expect(files[0].status).toBe(IMPORT_FILE_PARSED);
  });
});
