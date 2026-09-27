// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { ImportFormatError } from './importError.js';
import { describeImportOrigin } from './importRecord.js';
import { parseOdsFile } from './odsParser.js';
import {
  HEADER_ROW,
  contentXml,
  emptyCell,
  emptyRows,
  floatCell,
  odsBytes,
  productRow,
  row,
  singleSheetOds,
  textCell,
} from './odsFixtures.js';

const ORIGIN = { fileName: 'planilha-inventada.ods', fileIndex: 0 };

const WARDROBE = {
  code: 11,
  description: 'GUARDA ROUPA INVENTADO 6 PORTAS<text:s text:c="11"/>',
  barcode: '7890000000017',
  ncm: '94035000',
};
const STOVE = { code: 1218692, description: 'FOGAO INVENTADO 4 BOCAS', ncm: '73211100' };

async function read(rows) {
  return parseOdsFile(await singleSheetOds(rows), ORIGIN);
}

async function refusalOf(bytes) {
  try {
    await parseOdsFile(bytes, ORIGIN);
  } catch (error) {
    return error;
  }

  return null;
}

describe('parseOdsFile, campos', () => {
  it('le o cabecalho acentuado e guarda os campos com o nome da coluna', async () => {
    const records = await read([HEADER_ROW, productRow(WARDROBE), productRow(STOVE), emptyRows(1029642), emptyRows(1)]);

    expect(records).toHaveLength(2);
    expect(records[0].raw).toEqual({
      Código: '11',
      Descrição: 'GUARDA ROUPA INVENTADO 6 PORTAS',
      'Cód. Barras': '7890000000017',
      NCM: '94035000',
    });
    expect(records[1].raw).toEqual({
      Código: '1218692',
      Descrição: 'FOGAO INVENTADO 4 BOCAS',
      'Cód. Barras': '',
      NCM: '73211100',
    });
    expect(records[1].recordId).toBe('0:1');
    expect(records[1].source).toEqual({
      fileName: 'planilha-inventada.ods',
      fileIndex: 0,
      format: 'ods',
      index: 1,
      itemNumber: null,
      lineNumber: 3,
    });
  });

  it('guarda o numero como a planilha exibe, e nao o valor guardado', async () => {
    const header = row(['Código', 'Preço'].map(textCell));
    const [sofa] = await read([header, row([floatCell(11), floatCell(1299.9, '1.299,90')])]);

    expect(sofa.raw).toEqual({ Código: '11', Preço: '1.299,90' });
  });

  it('usa o valor guardado so quando a celula nao tem texto', async () => {
    const header = row(['Código', 'Estoque'].map(textCell));
    const cell = '<table:table-cell office:value-type="float" office:value="3"/>';
    const [rack] = await read([header, row([floatCell(20001), cell])]);

    expect(rack.raw.Estoque).toBe('3');
  });

  it('nao desloca coluna com celula vazia no meio nem com celulas repetidas', async () => {
    const records = await read([
      HEADER_ROW,
      row([floatCell(31), emptyCell(), textCell('7890000000024'), textCell('94036000')]),
      row([floatCell(32), emptyCell(2), textCell('84501100')]),
      row([floatCell(33), textCell('COLCHAO INVENTADO'), emptyCell(1022)]),
      row([floatCell(34), '<table:table-cell table:number-columns-repeated="2" office:value-type="string"><text:p>MESMO TEXTO</text:p></table:table-cell>', textCell('94017900')]),
    ]);

    expect(records.map((record) => record.raw)).toEqual([
      { Código: '31', Descrição: '', 'Cód. Barras': '7890000000024', NCM: '94036000' },
      { Código: '32', Descrição: '', 'Cód. Barras': '', NCM: '84501100' },
      { Código: '33', Descrição: 'COLCHAO INVENTADO', 'Cód. Barras': '', NCM: '' },
      { Código: '34', Descrição: 'MESMO TEXTO', 'Cód. Barras': 'MESMO TEXTO', NCM: '94017900' },
    ]);
  });

  it('aplica ao cabecalho as regras do CSV: nome aparado, sem nome fora, repetido fica o primeiro', async () => {
    const header = row([textCell('  Código '), emptyCell(), textCell('NCM'), textCell('Código')]);
    const [record] = await read([header, row([floatCell(40), textCell('ignorado'), textCell('94016100'), floatCell(41)])]);

    expect(record.raw).toEqual({ Código: '40', NCM: '94016100' });
  });
});

describe('parseOdsFile, linhas', () => {
  it('nao expande nem transforma em registro 1.000.000 de linhas vazias repetidas', async () => {
    const started = performance.now();
    const records = await read([HEADER_ROW, productRow(STOVE), emptyRows(1000000), emptyRows(1)]);

    expect(records).toHaveLength(1);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('pula a linha vazia no meio e continua contando as linhas seguintes', async () => {
    const records = await read([
      emptyRows(2),
      HEADER_ROW,
      productRow(WARDROBE),
      emptyRows(3),
      productRow(STOVE),
      row([emptyCell(), textCell('   '), emptyCell(2)]),
      productRow({ ...STOVE, code: 1218693 }),
    ]);

    expect(records.map((record) => record.source.lineNumber)).toEqual([4, 8, 10]);
    expect(records.map((record) => record.source.index)).toEqual([0, 1, 2]);
  });

  it('repete a linha preenchida repetida, uma linha por copia', async () => {
    const records = await read([HEADER_ROW, row([floatCell(50), textCell('CADEIRA INVENTADA'), emptyCell(), textCell('94017100')], 2)]);

    expect(records.map((record) => [record.raw.Código, record.source.lineNumber])).toEqual([
      ['50', 2],
      ['50', 3],
    ]);
  });

  it('escreve a origem com a linha da planilha e ponto nos milhares', async () => {
    const products = Array.from({ length: 1300 }, (_, i) => productRow({ ...STOVE, code: 100000 + i }));
    const records = await read([HEADER_ROW, ...products]);

    expect(describeImportOrigin(records[0])).toBe('planilha-inventada.ods, linha 2');
    expect(describeImportOrigin(records[1232])).toBe('planilha-inventada.ods, linha 1.234');
  });
});

describe('parseOdsFile, texto da celula', () => {
  it('troca text:s, tabulacao e quebra por espaco, decodifica entidades e une paragrafos', async () => {
    const header = row(['Código', 'Descrição'].map(textCell));
    const cell = (xml) => `<table:table-cell office:value-type="string">${xml}</table:table-cell>`;
    const records = await read([
      header,
      row([floatCell(1), textCell('MESA<text:s/>4<text:s text:c="3"/>CADEIRAS')]),
      row([floatCell(2), textCell('RACK &quot;TV 55&quot; &amp; PAINEL D&apos;ANGELO &lt;NOVO&gt;')]),
      row([floatCell(3), cell('<text:p>SOFA 3 LUGARES</text:p><text:p>RETRATIL</text:p>')]),
      row([floatCell(4), textCell('<text:s text:c="2"/>BALCAO<text:tab/>COZINHA<text:line-break/>BRANCO<text:s text:c="11"/>')]),
      row([floatCell(5), textCell('<text:span text:style-name="T1">ARMARIO</text:span> A&#199;O')]),
      row([floatCell(6), cell('<office:annotation><text:p>nota escondida</text:p></office:annotation><text:p>ESTANTE</text:p>')]),
    ]);

    expect(records.map((record) => record.raw.Descrição)).toEqual([
      'MESA 4   CADEIRAS',
      'RACK "TV 55" & PAINEL D\'ANGELO <NOVO>',
      'SOFA 3 LUGARES RETRATIL',
      'BALCAO COZINHA BRANCO',
      'ARMARIO AÇO',
      'ESTANTE',
    ]);
  });

  it('conserta o arquivo com texto lido na pagina 850, e deixa o cabecalho e o espaco sem quebra', async () => {
    const records = await read([
      HEADER_ROW,
      productRow({ code: 60, description: 'FogÒo a gßs 4 bocas', ncm: '73211100' }),
      productRow({ code: 61, description: 'BALC├O COZINHA VERIT┴', ncm: '94034000' }),
      productRow({ code: 62, description: 'ARMARIO AÇO Nº 3', ncm: '94031000' }),
      productRow({ code: 63, description: 'VENTILADOR 140 W INVENTADO', ncm: '84145990' }),
    ]);

    expect(Object.keys(records[0].raw)).toEqual(['Código', 'Descrição', 'Cód. Barras', 'NCM']);
    expect(records.map((record) => record.raw.Descrição)).toEqual([
      'Fogão a gás 4 bocas',
      'BALCÃO COZINHA VERITÁ',
      'ARMARIO AÇO Nº 3',
      'VENTILADOR 140 W INVENTADO',
    ]);
  });

  it('nao mexe no arquivo sem caractere de moldura', async () => {
    const descriptions = ['Fogão a gás 4 bocas', 'Micro-ondas Função Tira Odor', 'SEGURANÇA MÔNACO', 'FogÒo sem moldura'];
    const records = await read([
      HEADER_ROW,
      ...descriptions.map((description, i) => productRow({ code: 70 + i, description, ncm: '85165000' })),
    ]);

    expect(records.map((record) => record.raw.Descrição)).toEqual(descriptions);
  });
});

describe('parseOdsFile, abas', () => {
  it('le so a primeira aba', async () => {
    const bytes = await odsBytes(
      contentXml([
        { name: 'Planilha1', rows: [HEADER_ROW, productRow(STOVE)] },
        { name: 'Planilha2', rows: [HEADER_ROW, productRow(WARDROBE), productRow(WARDROBE)] },
      ]),
    );
    const records = await parseOdsFile(bytes, ORIGIN);

    expect(records.map((record) => record.raw.Código)).toEqual(['1218692']);
  });
});

describe('parseOdsFile, recusas', () => {
  it('recusa o XML malformado', async () => {
    const broken = [
      contentXml([{ name: 'Planilha1', rows: [HEADER_ROW, productRow(STOVE)] }]).replace('</table:table-row>', ''),
      contentXml([{ name: 'Planilha1', rows: [HEADER_ROW, row([textCell('MESA < INVENTADA')])] }]),
      contentXml([{ name: 'Planilha1', rows: [HEADER_ROW, row([textCell('MESA & CADEIRA')])] }]),
      contentXml([{ name: 'Planilha1', rows: [HEADER_ROW] }]).replace('</table:table>', ''),
    ];

    for (const xml of broken) {
      const error = await refusalOf(await odsBytes(xml));

      expect(error).toBeInstanceOf(ImportFormatError);
      expect(error.message).toBe('Planilha .ods malformada: o conteúdo da planilha não pôde ser lido.');
    }
  });

  it('recusa a planilha sem nenhuma linha preenchida', async () => {
    for (const rows of [[], [emptyRows(1048576)], [row([textCell('   '), emptyCell(3)])]]) {
      const error = await refusalOf(await singleSheetOds(rows));

      expect(error).toBeInstanceOf(ImportFormatError);
      expect(error.message).toBe('Planilha .ods vazia: a primeira aba não tem nenhuma linha preenchida.');
    }
  });

  it('recusa a planilha so com o cabecalho', async () => {
    const error = await refusalOf(await singleSheetOds([HEADER_ROW, emptyRows(1048575)]));

    expect(error).toBeInstanceOf(ImportFormatError);
    expect(error.message).toBe('Planilha .ods sem linhas de dados: a primeira aba tem apenas o cabeçalho.');
  });

  it('recusa o pacote que nao e planilha antes de ler qualquer linha', async () => {
    const error = await refusalOf(new TextEncoder().encode('Código;NCM\n1;94035000\n'));

    expect(error).toBeInstanceOf(ImportFormatError);
    expect(error.message).toMatch(/^Planilha \.ods inválida/);
  });
});

describe('parseOdsFile, desempenho', () => {
  it('le 20.000 linhas de quatro colunas em menos de 2 s', async () => {
    const products = Array.from({ length: 20000 }, (_, i) =>
      productRow({
        code: 100000 + i,
        description: `GUARDA ROUPA INVENTADO ${i}<text:s text:c="11"/>`,
        barcode: i % 7 === 0 ? String(7890000000000 + i) : '',
        ncm: '94035000',
      }),
    );
    const bytes = await singleSheetOds([HEADER_ROW, ...products, emptyRows(1029642), emptyRows(1)]);
    const started = performance.now();
    const records = await parseOdsFile(bytes, ORIGIN);
    const elapsed = performance.now() - started;

    expect(records).toHaveLength(20000);
    expect(records[19999].raw.Descrição).toBe('GUARDA ROUPA INVENTADO 19999');
    expect(elapsed).toBeLessThan(2000);
  }, 30_000);
});
