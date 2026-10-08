// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { describeImportOrigin } from './importRecord.js';
import { attachProductCandidate } from './productMapping.js';
import { bytesOf, footer, priceHeader, priceRow } from './txtReportFixtures.js';
import { isTabularText, parseTxtFile, parseTxtTable } from './txtTableParser.js';

/**
 * O `.txt` em colunas separadas por tabulacao — a planilha salva como texto —
 * e a escolha entre ele e o relatorio do ERP, que continua com o leitor dele.
 */

const ORIGIN = { fileName: 'cadastro-inventado.txt', fileIndex: 0 };

const LINES = [
  'Código\tDescrição\tNCM\tCód. Barras',
  '1620\tGUARDA ROUPA INVENTADO 6 PORTAS\t94035000\t7890000000017',
  '',
  '118114\t"FOGAO INVENTADO ""4 BOCAS"""\t73211100\t',
];

function utf8(lines) {
  return new TextEncoder().encode(lines.join('\r\n'));
}

function latin1(lines) {
  return Uint8Array.from(lines.join('\r\n'), (character) => character.charCodeAt(0));
}

describe('isTabularText', () => {
  it('reconhece a primeira linha preenchida com tabulacao', () => {
    expect(isTabularText('\n\nCódigo\tNCM\n1\t2')).toBe(true);
    expect(isTabularText('Código;NCM\n1;2')).toBe(false);
  });

  it('nao confunde o relatorio do ERP com planilha', () => {
    expect(isTabularText(['a\tb', '+----+-----+'].join('\n'))).toBe(false);
  });
});

describe('parseTxtTable', () => {
  it('le cada linha pelos nomes do cabecalho, pulando a vazia e tirando as aspas', () => {
    const records = parseTxtTable(LINES.join('\n'), ORIGIN);

    expect(records.map((item) => item.raw)).toEqual([
      {
        Código: '1620',
        Descrição: 'GUARDA ROUPA INVENTADO 6 PORTAS',
        NCM: '94035000',
        'Cód. Barras': '7890000000017',
      },
      { Código: '118114', Descrição: 'FOGAO INVENTADO "4 BOCAS"', NCM: '73211100', 'Cód. Barras': '' },
    ]);
    expect(describeImportOrigin(records[1])).toBe('cadastro-inventado.txt, linha 4');
  });

  it('traduz para os mesmos campos da planilha', () => {
    const [record] = parseTxtTable(LINES.join('\n'), ORIGIN).map(attachProductCandidate);

    expect(record.candidate).toEqual(
      expect.objectContaining({ systemCode: '1620', ncm: '94035000', ean: '7890000000017' }),
    );
  });

  it('recusa o arquivo so com o cabecalho ou com uma coluna so', () => {
    expect(() => parseTxtTable('Código\tNCM\n\n', ORIGIN)).toThrow(
      'Arquivo .txt sem linhas de dados: o arquivo tem apenas o cabeçalho.',
    );
    expect(() => parseTxtTable('Código\t\n1\t2', ORIGIN)).toThrow(/^Arquivo \.txt sem colunas/);
  });
});

describe('parseTxtFile', () => {
  it('le a planilha em UTF-8, com ou sem marca de ordem de bytes', () => {
    for (const bytes of [utf8(LINES), new Uint8Array([0xef, 0xbb, 0xbf, ...utf8(LINES)])]) {
      const [record] = parseTxtFile(bytes, ORIGIN);

      expect(Object.keys(record.raw)).toEqual(['Código', 'Descrição', 'NCM', 'Cód. Barras']);
    }
  });

  it('le a planilha salva em Latin-1', () => {
    const [record] = parseTxtFile(latin1(LINES), ORIGIN);

    expect(record.raw.Código).toBe('1620');
  });

  it('manda o relatorio do ERP para o leitor dele', () => {
    const report = bytesOf([
      ...priceHeader(1),
      priceRow({ code: '01620', description: 'GUARDA ROUPA INVENTADO' }),
      ...footer(1),
    ]);

    const [record] = parseTxtFile(report, ORIGIN);

    expect(record.raw.Codigo).toBe('01620');
  });

  it('diz as duas formas aceitas ao texto que nao e nenhuma delas', () => {
    expect(() => parseTxtFile(utf8(['texto qualquer', 'sem colunas']), ORIGIN)).toThrow(
      'Relatório em texto não reconhecido: são aceitos a Tabela de Preço e o Saldo de Estoque por Grupo do ERP, ou a planilha salva como texto, com as colunas separadas por tabulação.',
    );
  });
});
