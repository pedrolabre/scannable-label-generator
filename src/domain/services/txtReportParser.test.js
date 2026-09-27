// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { ImportFormatError } from './importError.js';
import { describeImportOrigin } from './importRecord.js';
import { parseTxtReport } from './txtReportParser.js';
import {
  PAGE_GAP,
  PRICE_RULER,
  STOCK_RULER,
  bytesOf,
  footer,
  priceHeader,
  priceRow,
  stockHeader,
  stockRow,
} from './txtReportFixtures.js';

const ORIGIN = { fileName: 'relatorio-inventado.TXT', fileIndex: 0 };

function refusalOf(bytes) {
  try {
    parseTxtReport(bytes, ORIGIN);
  } catch (error) {
    return error;
  }

  return null;
}

const TOWEL = {
  code: '118114',
  description: '  TOALHA ROSTO INVENTADA AF129',
  price: '29,90',
  stock: '2,00',
};
const STEEL = {
  code: '01620',
  description: 'ARMARIO A\x80O INVENTADO',
  stock: '-2,00',
  price: '1.234,56',
};
const ELBOW = {
  code: '20001',
  description: 'COTOVELO 90\xa7_____________',
  brand: '__________',
  stock: '0,50',
  price: '0,00',
};

const PRICE_REPORT = [
  ...priceHeader(1),
  priceRow(TOWEL),
  priceRow(STEEL),
  ...PAGE_GAP,
  ...priceHeader(2),
  priceRow(ELBOW),
  ...footer(3),
];

const STOCK_REPORT = [
  ...stockHeader(1),
  'Grupo: 12-CONFECCAO',
  stockRow({
    code: '001620',
    alternative: '15409.8',
    description: 'CAL\x80A FEM INVENTADA TAM. M',
    first: '30/04/2017',
  }),
  ...PAGE_GAP,
  ...stockHeader(2),
  stockRow({ code: '001628', description: 'BLUSA INVENTADA TAM-G', second: '18/01/2020' }),
  '-'.repeat(127),
  'Grupo: 21-MOVEIS',
  stockRow({
    code: '116660',
    alternative: '18499',
    description: 'GUARDA ROUPA INVENTADO 10PTS',
    stock: '3,50',
  }),
  ...footer(3),
];

describe('parseTxtReport, tabela de preco', () => {
  it('corta cada registro pela regua e guarda os campos com o nome da coluna', () => {
    const [towel] = parseTxtReport(bytesOf(PRICE_REPORT), ORIGIN);

    expect(towel.raw).toEqual({
      Codigo: '118114',
      Descricao: 'TOALHA ROSTO INVENTADA AF129',
      Marca: 'GERAL',
      Estoque: '2,00',
      UN: 'UN',
      'Preço R$': '29,90',
    });
    expect(towel.recordId).toBe('0:0');
    expect(towel.source).toEqual({
      fileName: 'relatorio-inventado.TXT',
      fileIndex: 0,
      format: 'txt',
      index: 0,
      itemNumber: null,
      lineNumber: 10,
    });
  });

  it('le os registros das duas paginas e ignora o cabecalho repetido, as linhas em branco e o rodape', () => {
    const records = parseTxtReport(bytesOf(PRICE_REPORT), ORIGIN);

    expect(records.map((record) => record.raw.Codigo)).toEqual(['118114', '01620', '20001']);
    expect(records.map((record) => record.source.index)).toEqual([0, 1, 2]);
    expect(records.map((record) => record.source.lineNumber)).toEqual([10, 11, 27]);
  });

  it('le igual o arquivo com CRLF e com LF', () => {
    const withCrLf = parseTxtReport(bytesOf(PRICE_REPORT, '\r\n'), ORIGIN);
    const withLf = parseTxtReport(bytesOf(PRICE_REPORT, '\n'), ORIGIN);

    expect(withLf).toEqual(withCrLf);
  });

  it('mantem o codigo como impresso, com o zero a esquerda', () => {
    const [, steel] = parseTxtReport(bytesOf(PRICE_REPORT), ORIGIN);

    expect(steel.raw.Codigo).toBe('01620');
  });

  it('mantem estoque negativo e fracionario e preco com a pontuacao do relatorio', () => {
    const [, steel, elbow] = parseTxtReport(bytesOf(PRICE_REPORT), ORIGIN);

    expect(steel.raw.Estoque).toBe('-2,00');
    expect(steel.raw['Preço R$']).toBe('1.234,56');
    expect(elbow.raw.Estoque).toBe('0,50');
    expect(elbow.raw['Preço R$']).toBe('0,00');
  });

  it('tira o sublinhado de preenchimento, e o campo so de sublinhado fica vazio', () => {
    const [towel, , elbow] = parseTxtReport(bytesOf(PRICE_REPORT), ORIGIN);

    expect(towel.raw.Marca).toBe('GERAL');
    expect(elbow.raw.Marca).toBe('');
    expect(elbow.raw.Descricao).toBe('COTOVELO 90º');
  });

  it('acentua a descricao escrita na pagina 850', () => {
    const [, steel] = parseTxtReport(bytesOf(PRICE_REPORT), ORIGIN);

    expect(steel.raw.Descricao).toBe('ARMARIO AÇO INVENTADO');
  });
});

describe('parseTxtReport, saldo de estoque', () => {
  it('guarda codigo, alternativo, descricao, unidade, estoque e grupo, sem as datas', () => {
    const [first] = parseTxtReport(bytesOf(STOCK_REPORT), ORIGIN);

    expect(first.raw).toEqual({
      Codigo: '001620',
      Alternativo: '15409.8',
      Descricao: 'CALÇA FEM INVENTADA TAM. M',
      UN: 'UN',
      'Est. Loja': '1,00',
      Grupo: '12-CONFECCAO',
    });
  });

  it('leva o grupo alem da quebra de pagina e troca na linha do grupo seguinte', () => {
    const records = parseTxtReport(bytesOf(STOCK_REPORT), ORIGIN);

    expect(records.map((record) => [record.raw.Codigo, record.raw.Grupo])).toEqual([
      ['001620', '12-CONFECCAO'],
      ['001628', '12-CONFECCAO'],
      ['116660', '21-MOVEIS'],
    ]);
    expect(records[2].raw['Est. Loja']).toBe('3,50');
  });
});

describe('parseTxtReport, conferencia do rodape e recusas', () => {
  it('recusa o relatorio cujo rodape informa outra contagem', () => {
    const lines = [...PRICE_REPORT.slice(0, -2), ...footer(4)];
    const refusal = refusalOf(bytesOf(lines));

    expect(refusal).toBeInstanceOf(ImportFormatError);
    expect(refusal.message).toBe(
      'Relatório incompleto (Tabela de Preço): o rodapé informa 4 registros, e foram lidos 3.',
    );
  });

  it('escreve as contagens com ponto nos milhares', () => {
    const rows = Array.from({ length: 1234 }, (_, index) =>
      priceRow({ code: String(100000 + index), description: 'PRODUTO INVENTADO' }),
    );
    const refusal = refusalOf(bytesOf([...priceHeader(1), ...rows, ...footer(1235)]));

    expect(refusal.message).toBe(
      'Relatório incompleto (Tabela de Preço): o rodapé informa 1.235 registros, e foram lidos 1.234.',
    );
  });

  it('recusa o relatorio sem rodape', () => {
    const refusal = refusalOf(bytesOf(PRICE_REPORT.slice(0, -2)));

    expect(refusal).toBeInstanceOf(ImportFormatError);
    expect(refusal.message).toBe(
      'Relatório incompleto (Tabela de Preço): o rodapé com o total de registros não foi encontrado.',
    );
  });

  it('recusa o arquivo vazio', () => {
    for (const bytes of [new Uint8Array(0), bytesOf(['', '   ', ''])]) {
      const refusal = refusalOf(bytes);

      expect(refusal).toBeInstanceOf(ImportFormatError);
      expect(refusal.message).toBe('Relatório em texto vazio: o arquivo não tem conteúdo.');
    }
  });

  it('recusa o relatorio de tipo desconhecido', () => {
    const lines = [
      '='.repeat(79),
      'Data: 01/02/2030                  * Contas a Receber *                    Pag: 0001',
      PRICE_RULER,
      priceRow(TOWEL),
      ...footer(1),
    ];
    const refusal = refusalOf(bytesOf(lines));

    expect(refusal).toBeInstanceOf(ImportFormatError);
    expect(refusal.message).toBe(
      'Relatório em texto não reconhecido: são aceitos a Tabela de Preço e o Saldo de Estoque por Grupo do ERP.',
    );
  });

  it('recusa o texto sem regua', () => {
    const lines = priceHeader(1).filter((line) => line !== PRICE_RULER);
    const refusal = refusalOf(bytesOf([...lines, priceRow(TOWEL), ...footer(1)]));

    expect(refusal).toBeInstanceOf(ImportFormatError);
    expect(refusal.message).toBe(
      'Relatório fora do formato esperado (Tabela de Preço): a régua das colunas (+---+) não foi encontrada.',
    );
  });

  it('recusa a regua com outra quantidade de colunas', () => {
    const lines = priceHeader(1).map((line) => (line === PRICE_RULER ? STOCK_RULER : line));
    const refusal = refusalOf(bytesOf([...lines, priceRow(TOWEL), ...footer(1)]));

    expect(refusal).toBeInstanceOf(ImportFormatError);
    expect(refusal.message).toBe(
      'Relatório fora do formato esperado (Tabela de Preço): a régua tem 8 colunas, e este relatório tem 6.',
    );
  });

  it('recusa o relatorio sem nenhum registro', () => {
    const refusal = refusalOf(bytesOf([...stockHeader(1), ...footer(0)]));

    expect(refusal).toBeInstanceOf(ImportFormatError);
    expect(refusal.message).toBe(
      'Relatório sem registros (Saldo de Estoque por Grupo): nenhuma linha de produto foi encontrada.',
    );
  });
});

describe('frase de origem do relatorio em texto', () => {
  it('aponta a linha fisica do arquivo, com o cabecalho de cada pagina contado', () => {
    const records = parseTxtReport(bytesOf(PRICE_REPORT), ORIGIN);

    expect(describeImportOrigin(records[0])).toBe('relatorio-inventado.TXT, linha 10');
    expect(describeImportOrigin(records[2])).toBe('relatorio-inventado.TXT, linha 27');
  });

  it('escreve a linha com ponto nos milhares', () => {
    const rows = Array.from({ length: 1300 }, (_, index) =>
      priceRow({ code: String(100000 + index), description: 'PRODUTO INVENTADO' }),
    );
    const records = parseTxtReport(bytesOf([...priceHeader(1), ...rows, ...footer(1300)]), ORIGIN);

    expect(describeImportOrigin(records[1224])).toBe('relatorio-inventado.TXT, linha 1.234');
  });
});

describe('parseTxtReport, desempenho', () => {
  it('le 20.000 registros em menos de 1 s', () => {
    const lines = [];

    for (let page = 0; page < 400; page += 1) {
      lines.push(...priceHeader(page + 1));

      for (let row = 0; row < 50; row += 1) {
        const code = String(page * 50 + row).padStart(6, '0');

        lines.push(
          priceRow({ code, description: `PRODUTO INVENTADO A\x80O ${code}`, price: '1.299,90' }),
        );
      }

      lines.push(...PAGE_GAP);
    }

    const bytes = bytesOf([...lines, ...footer(20000)]);
    const started = performance.now();
    const records = parseTxtReport(bytes, ORIGIN);
    const elapsed = performance.now() - started;

    expect(records).toHaveLength(20000);
    expect(records[19999].raw.Descricao).toBe('PRODUTO INVENTADO AÇO 019999');
    expect(elapsed).toBeLessThan(1000);
  }, 30_000);
});
