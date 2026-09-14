import { describe, expect, it } from 'vitest';

import { DESCRIPTION_MAX_LENGTH } from '../schemas/productSchema.js';

import { resolveCandidate } from './importCorrection.js';
import { createImportRecord } from './importRecord.js';
import {
  RECORD_STATUS_ATTENTION,
  RECORD_STATUS_READY,
  RECORD_STATUS_REFUSED,
  REPORT_REASON_CORRECTED,
  REPORT_REASON_DROPPED,
  REPORT_REASON_INVALID,
  REPORT_REASON_REVIEW,
  blocksWriting,
  describeRecord,
} from './importReport.js';
import {
  createImportReport,
  pushRecordReport,
  replaceRecordReport,
  takeReviewEntries,
  writableCount,
} from './importReportIndex.js';
import { validateCandidate } from './importValidation.js';
import { attachProductCandidate } from './productMapping.js';

/**
 * Toda nota e toda planilha deste arquivo sao escritas a mao, com valores
 * inventados. Nenhum valor vem de documento real.
 */
const LONG_PRODUCT_TEXT =
  'PRODUTO INVENTADO DE TESTE COM NOME COMPRIDO QUE PASSA DO LIMITE DA ETIQUETA';

function xmlRecord(prod, index = 0) {
  return attachProductCandidate(
    createImportRecord({
      fileName: 'nota-inventada.xml',
      fileIndex: 0,
      format: 'xml',
      index,
      itemNumber: String(index + 1),
      raw: prod,
    }),
  );
}

function csvRecord(row, index = 0) {
  return attachProductCandidate(
    createImportRecord({
      fileName: 'planilha-inventada.csv',
      fileIndex: 0,
      format: 'csv',
      index,
      raw: row,
    }),
  );
}

/**
 * A posicao do registro no lote sai do proprio registro: e ela que da o
 * `recordId`, e usar outra faria o relatorio apontar para o lugar errado.
 */
function reportFor(record, correction = null) {
  return describeRecord(
    record,
    validateCandidate(resolveCandidate(record, correction)),
    record.source.index,
    correction,
  );
}

const READY_RECORD = csvRecord({ systemCode: 'INV-1', nome: 'Produto inventado um', price: '12.50' });

const TRUNCATED_RECORD = xmlRecord(
  {
    cProd: 'INV-2',
    cEAN: 'SEM GTIN',
    xProd: LONG_PRODUCT_TEXT,
    uCom: 'UN',
    vUnCom: '10.0000',
  },
  1,
);

const NOT_UNITARY_RECORD = xmlRecord(
  {
    cProd: 'INV-3',
    cEAN: 'SEM GTIN',
    xProd: 'PRODUTO INVENTADO A GRANEL',
    uCom: 'KG',
    vUnCom: '19.9000',
  },
  2,
);

const BAD_CODE_RECORD = csvRecord(
  {
    systemCode: 'INV/4',
    nome: 'Produto inventado quatro',
    price: '5.00',
  },
  3,
);

describe('describeRecord', () => {
  it('registro sem nada a dizer fica pronto, sem linha nenhuma', () => {
    const entry = reportFor(READY_RECORD);

    expect(entry.status).toBe(RECORD_STATUS_READY);
    expect(entry.reasons).toEqual([]);
    expect(entry.lines).toEqual([]);
    expect(entry.corrected).toBe(false);
    expect(blocksWriting(entry)).toBe(false);
  });

  it('nome encurtado sem recusa do contrato pede conferencia e grava assim mesmo', () => {
    const entry = reportFor(TRUNCATED_RECORD);

    expect(entry.status).toBe(RECORD_STATUS_ATTENTION);
    expect(entry.reasons).toEqual([REPORT_REASON_REVIEW]);
    expect(blocksWriting(entry)).toBe(false);
    expect(entry.lines).toHaveLength(1);
    expect(entry.lines[0]).toMatchObject({
      field: 'displayName',
      blocking: false,
      cause: null,
      rawValue: LONG_PRODUCT_TEXT,
    });
    expect(entry.lines[0].message).toMatch(/Nome encurtado/);
  });

  it('aviso e recusa do mesmo campo cabem numa linha so, o veredito e a causa', () => {
    const entry = reportFor(NOT_UNITARY_RECORD);

    expect(entry.status).toBe(RECORD_STATUS_REFUSED);
    expect(entry.reasons).toEqual([REPORT_REASON_INVALID]);
    expect(blocksWriting(entry)).toBe(true);

    const priceLines = entry.lines.filter((line) => line.field === 'priceInCentavos');

    expect(priceLines).toHaveLength(1);
    expect(priceLines[0]).toEqual({
      field: 'priceInCentavos',
      blocking: true,
      message: 'Informe um preço válido. Ex.: 12,50',
      cause: 'A nota cobra por KG, e não por unidade. Informe o preço da etiqueta.',
      rawValue: '19.9000 por KG',
    });
  });

  it('recusa sem aviso nenhum traz so a frase do contrato', () => {
    const entry = reportFor(BAD_CODE_RECORD);

    expect(entry.status).toBe(RECORD_STATUS_REFUSED);
    expect(entry.lines).toEqual([
      {
        field: 'systemCode',
        blocking: true,
        message: 'Código do sistema aceita apenas letras, números e hífen',
        cause: null,
        rawValue: null,
      },
    ]);
  });

  it('a frase da linha e a do contrato, e nao uma copia da regra', () => {
    const record = csvRecord({
      systemCode: 'INV-4',
      nome: 'Produto inventado quatro',
      descricao: 'a'.repeat(DESCRIPTION_MAX_LENGTH + 1),
      price: '1.00',
    });

    const entry = reportFor(record);

    expect(entry.lines[0].message).toBe(
      `Descrição deve ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres`,
    );
  });

  it('campo do arquivo deixado de fora sem recusa pede conferencia, nao recusa', () => {
    const record = csvRecord({
      systemCode: 'INV-5',
      nome: 'Produto inventado cinco',
      price: '1.00',
      ean: '1234',
    });

    const entry = reportFor(record);

    expect(entry.status).toBe(RECORD_STATUS_ATTENTION);
    expect(entry.reasons).toEqual([REPORT_REASON_DROPPED]);
    expect(entry.lines[0]).toMatchObject({ field: 'ean', blocking: false, rawValue: '1234' });
  });

  it('a correcao do usuario apaga o aviso do campo corrigido e marca o registro', () => {
    const correction = { displayName: 'Nome inventado curto' };
    const entry = reportFor(TRUNCATED_RECORD, correction);

    expect(entry.status).toBe(RECORD_STATUS_ATTENTION);
    expect(entry.reasons).toEqual([REPORT_REASON_CORRECTED]);
    expect(entry.corrected).toBe(true);
    expect(entry.lines).toEqual([]);
  });

  it('a correcao que esvazia o nome e recusada pelo contrato, sem o aviso antigo', () => {
    const entry = reportFor(TRUNCATED_RECORD, { displayName: '' });

    expect(entry.status).toBe(RECORD_STATUS_REFUSED);
    expect(entry.lines).toEqual([
      {
        field: 'displayName',
        blocking: true,
        message: 'Nome da etiqueta obrigatório',
        cause: null,
        rawValue: null,
      },
    ]);
  });

  it('recusa que o contrato nao prende a campo nenhum ainda produz uma linha', () => {
    const record = { ...READY_RECORD, candidate: { ...READY_RECORD.candidate, cProd: 'INV-1' } };
    const entry = describeRecord(record, validateCandidate(record.candidate), 0);

    expect(entry.status).toBe(RECORD_STATUS_REFUSED);
    expect(entry.lines).toHaveLength(1);
    expect(entry.lines[0].field).toBeNull();
    expect(entry.lines[0].blocking).toBe(true);
  });
});

describe('relatorio do lote', () => {
  function buildReport(records) {
    const report = createImportReport();

    records.forEach((record) => pushRecordReport(report, reportFor(record)));

    return report;
  }

  const BATCH = [READY_RECORD, TRUNCATED_RECORD, NOT_UNITARY_RECORD];

  it('conta os tres estados e lista para revisao so o que tem motivo, na ordem do lote', () => {
    const report = buildReport(BATCH);

    expect(report.readyCount).toBe(1);
    expect(report.attentionCount).toBe(1);
    expect(report.refusedCount).toBe(1);
    expect(report.reviewIds).toEqual(['0:1', '0:2']);
    expect(writableCount(report)).toBe(2);
  });

  it('limita quantos registros a revisao entrega de uma vez', () => {
    const report = buildReport(BATCH);

    expect(takeReviewEntries(report, 1).map((entry) => entry.recordId)).toEqual(['0:1']);
    expect(takeReviewEntries(report, 10)).toHaveLength(2);
  });

  it('a correcao troca a entrada e acerta as contagens sem refazer o lote', () => {
    const report = buildReport(BATCH);
    const correction = { displayName: 'Nome inventado curto' };
    const next = replaceRecordReport(report, reportFor(TRUNCATED_RECORD, correction));

    expect(next.attentionCount).toBe(1);
    expect(next.readyCount).toBe(1);
    expect(next.reviewIds).toEqual(['0:1', '0:2']);
    expect(next.entries.get('0:1').corrected).toBe(true);
  });

  it('o registro que entra na revisao volta na ordem do lote, e o que sai some da lista', () => {
    const report = buildReport(BATCH);

    const entered = replaceRecordReport(
      report,
      reportFor(READY_RECORD, { displayName: 'Outro nome inventado' }),
    );

    expect(entered.reviewIds).toEqual(['0:0', '0:1', '0:2']);
    expect(entered.readyCount).toBe(0);
    expect(entered.attentionCount).toBe(2);

    const left = replaceRecordReport(entered, reportFor(READY_RECORD));

    expect(left.reviewIds).toEqual(['0:1', '0:2']);
    expect(left.readyCount).toBe(1);
    expect(left.attentionCount).toBe(1);
  });

  it('corrigir so o nome nao resolve a recusa do preco', () => {
    const report = buildReport(BATCH);
    const next = replaceRecordReport(
      report,
      reportFor(NOT_UNITARY_RECORD, { displayName: 'Nome inventado' }),
    );

    expect(next.reviewIds).toEqual(['0:1', '0:2']);
    expect(next.refusedCount).toBe(1);
    expect(next.entries.get('0:2').status).toBe(RECORD_STATUS_REFUSED);
  });
});
