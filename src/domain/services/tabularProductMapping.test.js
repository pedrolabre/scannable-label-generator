// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { IMPORT_FORMAT_ODS, IMPORT_FORMAT_TXT, createImportRecord } from './importRecord.js';
import { mapRecordToCandidate } from './productMapping.js';
import { readTabularProductSources } from './tabularProductMapping.js';
import { parseTxtReport } from './txtReportParser.js';
import {
  bytesOf,
  footer,
  priceHeader,
  priceRow,
  stockHeader,
  stockRow,
} from './txtReportFixtures.js';

/**
 * Os nomes de coluna dos relatorios em texto do ERP e da planilha cadastral,
 * traduzidos para os campos do produto. Os relatorios passam pelo leitor de
 * verdade, montados com as amostras inventadas; a planilha entra como registro
 * ja lido, com os nomes do cabecalho dela.
 */

const ORIGIN = { fileName: 'relatorio-inventado.TXT', fileIndex: 0 };

function sheetRecord(raw) {
  return createImportRecord({
    fileName: 'planilha-inventada.ods',
    fileIndex: 0,
    format: IMPORT_FORMAT_ODS,
    index: 0,
    lineNumber: 2,
    raw,
  });
}

function priceRecords(rows) {
  return parseTxtReport(bytesOf([...priceHeader(1), ...rows.map(priceRow), ...footer(rows.length)]), ORIGIN);
}

describe('readTabularProductSources, nomes dos arquivos do ERP', () => {
  it('reconhece o preco com o simbolo da moeda no nome, com ou sem acento e em qualquer caixa', () => {
    for (const column of ['Preço R$', 'PRECO R$', ' preço r$ ']) {
      expect(readTabularProductSources({ [column]: '29,90' }).sources.priceInCentavos).toBe('29,90');
    }
  });

  it('reconhece o codigo de barras abreviado da planilha cadastral', () => {
    for (const column of ['Cód. Barras', 'COD. BARRAS']) {
      expect(readTabularProductSources({ [column]: '7890000000017' }).sources.ean).toBe(
        '7890000000017',
      );
    }
  });

  it('continua com o separador decimal descoberto pelo proprio texto', () => {
    expect(readTabularProductSources({ 'Preço R$': '1.234,56' }).priceDecimalSeparator).toBe('auto');
  });
});

describe('mapRecordToCandidate, tabela de preco do ERP', () => {
  const [sofa, wardrobe, stool] = priceRecords([
    { code: '118114', description: 'SOFA INVENTADO 3 LUGARES', price: '1.234,56', stock: '2,00' },
    { code: '01620', description: 'GUARDA ROUPA INVENTADO 6PTS', price: '29,90', stock: '-2,00' },
    { code: '20001', description: 'BANQUETA INVENTADA', brand: 'MARCA_____', price: '0,00', stock: '0,50' },
  ]).map(mapRecordToCandidate);

  it('le o preco com milhar, sem milhar e zerado em centavos', () => {
    expect(sofa.candidate.priceInCentavos).toBe(123456);
    expect(wardrobe.candidate.priceInCentavos).toBe(2990);
    expect(stool.candidate.priceInCentavos).toBe(0);
  });

  it('nao deixa aviso de preco em nenhum dos tres', () => {
    for (const { issues } of [sofa, wardrobe, stool]) {
      expect(issues.filter((issue) => issue.field === 'priceInCentavos')).toEqual([]);
    }
  });

  it('mantem o codigo como o relatorio o imprime, com o zero a esquerda', () => {
    expect(wardrobe.candidate.systemCode).toBe('01620');
    expect(sofa.candidate.systemCode).toBe('118114');
  });

  it('usa a descricao como nome e como descricao', () => {
    expect(sofa.candidate.displayName).toBe('SOFA INVENTADO 3 LUGARES');
    expect(sofa.candidate.description).toBe('SOFA INVENTADO 3 LUGARES');
  });

  it('deixa marca, estoque e unidade fora do produto', () => {
    expect(Object.keys(stool.candidate).sort()).toEqual(
      ['description', 'displayName', 'priceInCentavos', 'systemCode'].sort(),
    );
    expect(JSON.stringify(stool.candidate)).not.toContain('MARCA');
  });
});

describe('mapRecordToCandidate, saldo de estoque do ERP', () => {
  const [record] = parseTxtReport(
    bytesOf([
      ...stockHeader(1),
      'Grupo: 21-MOVEIS',
      stockRow({ code: '001620', alternative: '15409.8', description: 'RACK INVENTADO', stock: '3,50' }),
      ...footer(1),
    ]),
    ORIGIN,
  );
  const { candidate } = mapRecordToCandidate(record);

  it('le o grupo como categoria', () => {
    expect(candidate.category).toBe('21-MOVEIS');
  });

  it('deixa o preco de fora, sem aviso: o relatorio nao tem coluna de preco', () => {
    expect(candidate.priceInCentavos).toBeUndefined();
    expect(mapRecordToCandidate(record).issues).toEqual([]);
  });

  it('deixa o codigo alternativo, a unidade e o estoque fora do produto', () => {
    expect(Object.keys(candidate).sort()).toEqual(
      ['category', 'description', 'displayName', 'systemCode'].sort(),
    );
    expect(candidate.systemCode).toBe('001620');
  });
});

describe('mapRecordToCandidate, planilha cadastral', () => {
  it('le o codigo de barras e o NCM', () => {
    const { candidate, issues } = mapRecordToCandidate(
      sheetRecord({
        Código: '1620',
        Descrição: 'GUARDA ROUPA INVENTADO 6 PORTAS BRANCO',
        'Cód. Barras': '7890000000017',
        NCM: '94035000',
      }),
    );

    expect(candidate.ean).toBe('7890000000017');
    expect(candidate.ncm).toBe('94035000');
    expect(issues).toEqual([]);
  });

  it('transforma o codigo de barras fora do padrao em aviso, com o texto do arquivo', () => {
    for (const barcode of ['789000000001712', '4CJ1066CR3/671']) {
      const { candidate, issues } = mapRecordToCandidate(
        sheetRecord({ Código: '11', Descrição: 'MESA INVENTADA', 'Cód. Barras': barcode, NCM: '94036000' }),
      );

      expect(candidate.ean).toBeUndefined();
      expect(issues).toEqual([expect.objectContaining({ field: 'ean', rawValue: barcode })]);
    }
  });

  it('le o NCM com ponto e transforma o de sete digitos em aviso', () => {
    const dotted = mapRecordToCandidate(
      sheetRecord({ Código: '11', Descrição: 'MESA INVENTADA', 'Cód. Barras': '', NCM: '9403.50.00' }),
    );
    const short = mapRecordToCandidate(
      sheetRecord({ Código: '12', Descrição: 'CADEIRA INVENTADA', 'Cód. Barras': '', NCM: '3909409' }),
    );

    expect(dotted.candidate.ncm).toBe('94035000');
    expect(short.candidate.ncm).toBeUndefined();
    expect(short.issues).toEqual([expect.objectContaining({ field: 'ncm', rawValue: '3909409' })]);
  });

  it('nao traz preco, e o registro segue sem ele', () => {
    const { candidate } = mapRecordToCandidate(
      sheetRecord({ Código: '11', Descrição: 'MESA INVENTADA', 'Cód. Barras': '', NCM: '94036000' }),
    );

    expect(candidate.priceInCentavos).toBeUndefined();
  });
});

describe('mapRecordToCandidate, formato do registro', () => {
  it('trata o relatorio em texto como planilha, e nao como nota fiscal', () => {
    const record = createImportRecord({
      fileName: 'relatorio.TXT',
      fileIndex: 0,
      format: IMPORT_FORMAT_TXT,
      index: 0,
      lineNumber: 10,
      raw: { Codigo: '118114', Descricao: 'SOFA INVENTADO', 'Preço R$': '1.299,90' },
    });

    expect(mapRecordToCandidate(record).candidate).toEqual({
      systemCode: '118114',
      displayName: 'SOFA INVENTADO',
      description: 'SOFA INVENTADO',
      priceInCentavos: 129990,
    });
  });
});
