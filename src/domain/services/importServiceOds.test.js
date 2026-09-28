// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  COMPLETION_FILE_EXTENSIONS,
  IMPORT_FILE_PARSED,
  IMPORT_FILE_REJECTED,
  parseImportFiles,
} from './importService.js';
import { HEADER_ROW, emptyRows, productRow, singleSheetOds } from './odsFixtures.js';
import { bytesOf, footer, priceHeader, priceRow } from './txtReportFixtures.js';

/**
 * A planilha OpenDocument na entrada do importador. O ambiente e o do Node
 * porque o pacote de teste e montado com `CompressionStream`, que depende do
 * `Blob.stream()` que o jsdom nao tem.
 */

const COMPLETION = { acceptedExtensions: COMPLETION_FILE_EXTENSIONS };

async function sheet() {
  return singleSheetOds([
    HEADER_ROW,
    productRow({
      code: 1620,
      description: 'GUARDA ROUPA INVENTADO 6 PORTAS',
      barcode: '7890000000017',
      ncm: '94035000',
    }),
    productRow({ code: 118114, description: 'SOFA INVENTADO 3 LUGARES', ncm: '9401.61.00' }),
    emptyRows(1000),
  ]);
}

function fileFrom(name, content) {
  return new File([content], name, { type: 'application/octet-stream' });
}

describe('parseImportFiles, planilha OpenDocument no caminho de completar', () => {
  it('le a planilha como bytes e traduz cada linha para os campos do produto', async () => {
    const { records, files } = await parseImportFiles([fileFrom('cadastro.ods', await sheet())], COMPLETION);

    expect(files).toEqual([
      expect.objectContaining({ status: IMPORT_FILE_PARSED, format: 'ods', recordCount: 2 }),
    ]);
    expect(records.map((record) => record.candidate)).toEqual([
      {
        systemCode: '1620',
        displayName: 'GUARDA ROUPA INVENTADO 6 PORTAS',
        description: 'GUARDA ROUPA INVENTADO 6 PORTAS',
        ean: '7890000000017',
        ncm: '94035000',
      },
      {
        systemCode: '118114',
        displayName: 'SOFA INVENTADO 3 LUGARES',
        description: 'SOFA INVENTADO 3 LUGARES',
        ncm: '94016100',
      },
    ]);
  });

  it('aceita a extensao em maiusculas', async () => {
    const { files } = await parseImportFiles([fileFrom('CADASTRO.ODS', await sheet())], COMPLETION);

    expect(files[0]).toEqual(expect.objectContaining({ status: IMPORT_FILE_PARSED, format: 'ods' }));
  });

  it('le a planilha e o relatorio em texto no mesmo lote', async () => {
    const report = bytesOf([
      ...priceHeader(1),
      priceRow({ code: '01620', description: 'GUARDA ROUPA INVENTADO 6PTS', price: '1.299,90' }),
      ...footer(1),
    ]);

    const { records, files } = await parseImportFiles(
      [fileFrom('cadastro.ods', await sheet()), fileFrom('tabela.TXT', report)],
      COMPLETION,
    );

    expect(files.map((file) => file.format)).toEqual(['ods', 'txt']);
    expect(records).toHaveLength(3);
  });

  it('recusa o arquivo que nao e planilha com a frase do leitor, sem parar o lote', async () => {
    const { records, files } = await parseImportFiles(
      [fileFrom('renomeado.ods', 'isto e texto, e nao um pacote'), fileFrom('cadastro.ods', await sheet())],
      COMPLETION,
    );

    expect(files[0].status).toBe(IMPORT_FILE_REJECTED);
    expect(files[0].error).toMatch(/^Planilha \.ods inválida/);
    expect(files[1].status).toBe(IMPORT_FILE_PARSED);
    expect(records).toHaveLength(2);
  });
});

describe('parseImportFiles, planilha OpenDocument na importacao de produtos', () => {
  it('recusa a planilha valida como formato nao aceito', async () => {
    const { records, files } = await parseImportFiles([fileFrom('cadastro.ods', await sheet())]);

    expect(files[0]).toEqual(
      expect.objectContaining({ status: IMPORT_FILE_REJECTED, format: null }),
    );
    expect(files[0].error).toMatch(/^Formato não aceito/);
    expect(records).toEqual([]);
  });
});
