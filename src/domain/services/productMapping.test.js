import { describe, expect, it } from 'vitest';

import { createImportRecord } from './importRecord.js';
import {
  ISSUE_DISPLAY_NAME_TRUNCATED,
  ISSUE_EAN_UNEXPECTED_LENGTH,
  ISSUE_PRICE_NEGATIVE,
  ISSUE_PRICE_NOT_UNITARY,
  ISSUE_PRICE_UNREADABLE,
} from './productCandidateIssue.js';
import { attachProductCandidate, mapRecordToCandidate, suggestDisplayName } from './productMapping.js';

/**
 * Todos os valores daqui sao inventados. Nenhum vem de nota fiscal real.
 */

const LONG_NAME = 'COLCHAO INVENTADO MOLEJO ENSACADO ALT:320 COMP:1980 LARG:1580 COR:2-PRETO';
const LONG_NAME_SHORTENED = 'COLCHAO INVENTADO MOLEJO ENSACADO ALT:320 COMP:1980';

function xmlRecord(raw) {
  return createImportRecord({
    fileName: 'nota-inventada.xml',
    fileIndex: 0,
    format: 'xml',
    index: 0,
    itemNumber: '1',
    raw,
  });
}

function csvRecord(raw) {
  return createImportRecord({
    fileName: 'planilha-inventada.csv',
    fileIndex: 0,
    format: 'csv',
    index: 0,
    raw,
  });
}

function candidateFrom(record) {
  return mapRecordToCandidate(record).candidate;
}

function issuesFrom(record) {
  return mapRecordToCandidate(record).issues;
}

function codesFrom(record) {
  return issuesFrom(record).map((issue) => issue.code);
}

const UNIT_ITEM = {
  cProd: '117504',
  cEAN: '7890000000017',
  xProd: 'PRODUTO INVENTADO UM',
  uCom: 'UN',
  qCom: '1.0000',
  vUnCom: '12.5000',
  vProd: '12.50',
};

describe('mapRecordToCandidate, registro de NFC-e', () => {
  it('leva cada tag de produto ao campo correspondente do contrato', () => {
    expect(candidateFrom(xmlRecord(UNIT_ITEM))).toEqual({
      systemCode: '117504',
      displayName: 'PRODUTO INVENTADO UM',
      description: 'PRODUTO INVENTADO UM',
      priceInCentavos: 1250,
      ean: '7890000000017',
    });
  });

  it('nao acrescenta nem altera nada em raw e source', () => {
    const record = xmlRecord(UNIT_ITEM);
    const mapped = attachProductCandidate(record);

    expect(mapped.raw).toEqual(UNIT_ITEM);
    expect(mapped.source).toEqual(record.source);
    expect(mapped.recordId).toBe(record.recordId);
    expect(mapped.candidate.systemCode).toBe('117504');
    expect(mapped.candidateIssues).toEqual([]);
  });

  it('deixa o codigo do sistema passar como veio, para o contrato recusar com a frase dele', () => {
    expect(candidateFrom(xmlRecord({ ...UNIT_ITEM, cProd: 'COD 12/A' })).systemCode).toBe('COD 12/A');
    expect(codesFrom(xmlRecord({ ...UNIT_ITEM, cProd: 'COD 12/A' }))).toEqual([]);
  });

  it('nao tem origem para categoria nem para observacoes', () => {
    const candidate = candidateFrom(xmlRecord(UNIT_ITEM));

    expect(candidate).not.toHaveProperty('category');
    expect(candidate).not.toHaveProperty('notes');
  });
});

describe('mapRecordToCandidate, preco da nota', () => {
  it('arredonda de meio para cima na terceira casa e ignora a quarta', () => {
    expect(candidateFrom(xmlRecord({ ...UNIT_ITEM, vUnCom: '12.5000' })).priceInCentavos).toBe(1250);
    expect(candidateFrom(xmlRecord({ ...UNIT_ITEM, vUnCom: '0.8333' })).priceInCentavos).toBe(83);
    expect(candidateFrom(xmlRecord({ ...UNIT_ITEM, vUnCom: '0.8355' })).priceInCentavos).toBe(84);
    expect(candidateFrom(xmlRecord({ ...UNIT_ITEM, vUnCom: '1585.9' })).priceInCentavos).toBe(158590);
  });

  it('omite o preco de item cobrado por medida continua, com o motivo escrito', () => {
    const record = xmlRecord({ ...UNIT_ITEM, uCom: 'KG', vUnCom: '32.9000' });
    const { candidate, issues } = mapRecordToCandidate(record);

    expect(candidate).not.toHaveProperty('priceInCentavos');
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe(ISSUE_PRICE_NOT_UNITARY);
    expect(issues[0].field).toBe('priceInCentavos');
    expect(issues[0].message).toContain('KG');
    expect(issues[0].rawValue).toContain('32.9000');
  });

  it('mantem o item de medida continua como registro, com os demais campos intactos', () => {
    const candidate = candidateFrom(xmlRecord({ ...UNIT_ITEM, uCom: 'MT', vUnCom: '9.9000' }));

    expect(candidate.systemCode).toBe('117504');
    expect(candidate.ean).toBe('7890000000017');
    expect(candidate.displayName).toBe('PRODUTO INVENTADO UM');
  });

  it('aceita abreviacao de contagem nao prevista, porque a lista e de medidas continuas', () => {
    for (const unit of ['UND', 'PCT', 'CJ', 'CX', 'PAR']) {
      expect(candidateFrom(xmlRecord({ ...UNIT_ITEM, uCom: unit })).priceInCentavos).toBe(1250);
    }
  });

  it('omite o preco ausente sem aviso, porque o contrato ja cobra a falta', () => {
    const { candidate, issues } = mapRecordToCandidate(xmlRecord({ ...UNIT_ITEM, vUnCom: '' }));

    expect(candidate).not.toHaveProperty('priceInCentavos');
    expect(issues).toEqual([]);
  });

  it('avisa quando ha valor no arquivo e ele nao e um preco', () => {
    expect(codesFrom(xmlRecord({ ...UNIT_ITEM, vUnCom: 'a combinar' }))).toEqual([
      ISSUE_PRICE_UNREADABLE,
    ]);
    expect(codesFrom(xmlRecord({ ...UNIT_ITEM, vUnCom: '-10.0000' }))).toEqual([
      ISSUE_PRICE_NEGATIVE,
    ]);
  });
});

describe('mapRecordToCandidate, codigo de barras', () => {
  it('aceita as quatro quantidades de digitos do contrato', () => {
    for (const barcode of ['00000017', '000000000017', '7890000000017', '17890000000017']) {
      expect(candidateFrom(xmlRecord({ ...UNIT_ITEM, cEAN: barcode })).ean).toBe(barcode);
    }
  });

  it('trata ausencia de GTIN como falta de codigo, sem aviso', () => {
    for (const absent of ['SEM GTIN', 'Sem GTIN', '']) {
      const { candidate, issues } = mapRecordToCandidate(xmlRecord({ ...UNIT_ITEM, cEAN: absent }));

      expect(candidate).not.toHaveProperty('ean');
      expect(issues).toEqual([]);
    }
  });

  it('avisa quando o codigo existe mas esta fora das quantidades aceitas', () => {
    const { candidate, issues } = mapRecordToCandidate(xmlRecord({ ...UNIT_ITEM, cEAN: '12345678901' }));

    expect(candidate).not.toHaveProperty('ean');
    expect(issues[0].code).toBe(ISSUE_EAN_UNEXPECTED_LENGTH);
    expect(issues[0].message).toContain('11');
    expect(issues[0].rawValue).toBe('12345678901');
  });

  it('avisa quando o codigo nao e composto so de digitos', () => {
    expect(codesFrom(xmlRecord({ ...UNIT_ITEM, cEAN: '7.89E+12' }))).toEqual([
      ISSUE_EAN_UNEXPECTED_LENGTH,
    ]);
  });
});

describe('suggestDisplayName', () => {
  it('mantem inteiro o texto que ja cabe no limite', () => {
    expect(suggestDisplayName('PRODUTO INVENTADO CURTO')).toEqual({
      value: 'PRODUTO INVENTADO CURTO',
      truncated: false,
    });
  });

  it('corta na fronteira de palavra e nao no meio dela', () => {
    expect(suggestDisplayName(LONG_NAME)).toEqual({
      value: LONG_NAME_SHORTENED,
      truncated: true,
    });
  });

  it('corta no limite quando nao ha espaco dentro dele', () => {
    const glued = 'A'.repeat(70);

    expect(suggestDisplayName(glued)).toEqual({ value: 'A'.repeat(60), truncated: true });
  });

  it('devolve nome vazio para texto vazio, sem inventar marcador', () => {
    expect(suggestDisplayName('   ')).toEqual({ value: '', truncated: false });
    expect(suggestDisplayName(undefined)).toEqual({ value: '', truncated: false });
  });
});

describe('mapRecordToCandidate, nome da etiqueta', () => {
  it('guarda o texto completo na descricao e o encurtado no nome, com aviso', () => {
    const { candidate, issues } = mapRecordToCandidate(xmlRecord({ ...UNIT_ITEM, xProd: LONG_NAME }));

    expect(candidate.description).toBe(LONG_NAME);
    expect(candidate.displayName).toBe(LONG_NAME_SHORTENED);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe(ISSUE_DISPLAY_NAME_TRUNCATED);
    expect(issues[0].rawValue).toBe(LONG_NAME);
  });

  it('nao avisa encurtamento quando o texto ja cabia', () => {
    expect(codesFrom(xmlRecord(UNIT_ITEM))).toEqual([]);
  });

  it('deixa nome e descricao vazios quando a nota nao nomeia o produto', () => {
    const { candidate, issues } = mapRecordToCandidate(xmlRecord({ ...UNIT_ITEM, xProd: '' }));

    expect(candidate.displayName).toBe('');
    expect(candidate).not.toHaveProperty('description');
    expect(issues).toEqual([]);
  });
});

describe('mapRecordToCandidate, planilha e JSON', () => {
  it('reconhece os nomes de coluna em portugues', () => {
    const candidate = candidateFrom(
      csvRecord({
        codigo: 'INV-1',
        nome: 'Produto inventado',
        descricao: 'Produto inventado, descricao completa',
        preco: '12,50',
        'codigo de barras': '7890000000017',
        categoria: 'Inventados',
        observacoes: 'Observacao inventada',
      }),
    );

    expect(candidate).toEqual({
      systemCode: 'INV-1',
      displayName: 'Produto inventado',
      description: 'Produto inventado, descricao completa',
      priceInCentavos: 1250,
      ean: '7890000000017',
      category: 'Inventados',
      notes: 'Observacao inventada',
    });
  });

  it('ignora acentuacao, caixa e espaco no nome da coluna', () => {
    const candidate = candidateFrom(
      csvRecord({ '  CÓDIGO  ': 'INV-2', 'Descrição': 'Produto inventado dois' }),
    );

    expect(candidate.systemCode).toBe('INV-2');
    expect(candidate.description).toBe('Produto inventado dois');
  });

  it('le o preco nas duas convencoes decimais', () => {
    expect(candidateFrom(csvRecord({ preco: '12,50' })).priceInCentavos).toBe(1250);
    expect(candidateFrom(csvRecord({ preco: '12.50' })).priceInCentavos).toBe(1250);
    expect(candidateFrom(csvRecord({ preco: 'R$ 1.234,56' })).priceInCentavos).toBe(123456);
  });

  it('aproveita a descricao como nome quando nao ha coluna de nome', () => {
    expect(candidateFrom(csvRecord({ descricao: 'Produto inventado tres' })).displayName).toBe(
      'Produto inventado tres',
    );
  });

  it('encurta o nome longo da planilha pela mesma regra do XML', () => {
    const { candidate, issues } = mapRecordToCandidate(csvRecord({ nome: LONG_NAME }));

    expect(candidate.displayName).toBe(LONG_NAME_SHORTENED);
    expect(issues[0].code).toBe(ISSUE_DISPLAY_NAME_TRUNCATED);
  });

  it('deixa de fora a coluna que nao esta na lista de nomes reconhecidos', () => {
    const candidate = candidateFrom(csvRecord({ codigo: 'INV-4', ncm: '00000000', cfop: '5102' }));

    expect(candidate).toEqual({ systemCode: 'INV-4', displayName: '' });
  });

  it('mantem a primeira coluna quando duas apontam para o mesmo campo', () => {
    expect(candidateFrom(csvRecord({ codigo: 'INV-5', sku: 'INV-6' })).systemCode).toBe('INV-5');
  });

  it('vale para JSON com os mesmos nomes de campo', () => {
    const record = createImportRecord({
      fileName: 'lista-inventada.json',
      fileIndex: 1,
      format: 'json',
      index: 0,
      raw: { codigo: 'INV-7', nome: 'Produto inventado sete', preco: '3,99' },
    });

    expect(candidateFrom(record)).toEqual({
      systemCode: 'INV-7',
      displayName: 'Produto inventado sete',
      priceInCentavos: 399,
    });
  });
});
