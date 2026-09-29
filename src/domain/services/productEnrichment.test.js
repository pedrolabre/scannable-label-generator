// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { ProductSchema } from '../schemas/productSchema.js';

import { comparableCode } from './catalogCompletion.js';
import { IMPORT_FORMAT_CSV, createImportRecord } from './importRecord.js';
import { validateCandidate } from './importValidation.js';
import { HEADER_ROW, productRow, singleSheetOds } from './odsFixtures.js';
import { parseOdsFile } from './odsParser.js';
import { ISSUE_EAN_UNEXPECTED_LENGTH, ISSUE_NCM_UNEXPECTED_FORMAT } from './productCandidateIssue.js';
import { ENRICHABLE_FIELDS, enrichImportRecords, referenceCodesFor } from './productEnrichment.js';
import { attachProductCandidate } from './productMapping.js';
import { buildReferenceEntries } from './referenceEntries.js';
import { bytesOf, footer, priceHeader, priceRow, stockHeader, stockRow } from './txtReportFixtures.js';
import { parseTxtReport } from './txtReportParser.js';

/**
 * O enriquecimento sobre registros traduzidos de verdade: a Tabela de Preco e o
 * Saldo de Estoque saem do leitor de relatorios, a base sai da planilha
 * cadastral pela funcao de entradas, e o mapa entregue ao enriquecimento e o
 * mesmo que a busca em lista da base devolve — o codigo como foi pedido para o
 * NCM e o codigo de barras da linha.
 */

const SHEET_ROWS = [
  productRow({ code: 1620, description: 'GUARDA ROUPA INVENTADO 6 PORTAS', barcode: '7890000000017', ncm: '94035000' }),
  productRow({ code: 118114, description: 'FOGAO INVENTADO 4 BOCAS', ncm: '73211100' }),
  productRow({ code: 5001, description: 'RACK INVENTADO', barcode: '7890000000024', ncm: '94036000' }),
];

const PRICE_REPORT = bytesOf([
  ...priceHeader(1),
  priceRow({ code: '01620', description: 'GUARDA ROUPA INVENTADO 6PTS', price: '1.299,90' }),
  priceRow({ code: '118114', description: 'FOGAO INVENTADO 4 BOCAS', price: '899,00' }),
  priceRow({ code: '777777', description: 'POLTRONA INVENTADA', price: '450,00' }),
  ...footer(3),
]);

const STOCK_REPORT = bytesOf([
  ...stockHeader(1),
  'Grupo: 21-MOVEIS',
  stockRow({ code: '001620', description: 'GUARDA ROUPA INVENTADO 6PTS' }),
  ...footer(1),
]);

async function referenceEntries() {
  const records = await parseOdsFile(await singleSheetOds([HEADER_ROW, ...SHEET_ROWS]), {
    fileName: 'cadastro-inventado.ods',
    fileIndex: 0,
  });

  return buildReferenceEntries(records.map(attachProductCandidate)).entries;
}

// O mesmo mapa que a busca em lista da base devolve para os codigos pedidos.
async function referencesFor(records) {
  const byKey = new Map((await referenceEntries()).map((entry) => [entry.comparableCode, entry]));
  const references = new Map();

  for (const code of referenceCodesFor(records)) {
    const entry = byKey.get(comparableCode(code));

    if (entry) {
      const { systemCode, ncm, ean } = entry;

      references.set(code, { systemCode, ...(ncm ? { ncm } : {}), ...(ean ? { ean } : {}) });
    }
  }

  return references;
}

function reportRecords(bytes) {
  return parseTxtReport(bytes, { fileName: 'tabela-inventada.txt', fileIndex: 0 }).map(attachProductCandidate);
}

function listRecord(raw, index = 0) {
  return attachProductCandidate(
    createImportRecord({ fileName: 'lista-inventada.csv', fileIndex: 1, format: IMPORT_FORMAT_CSV, index, raw }),
  );
}

async function enrich(records) {
  return enrichImportRecords(records, await referencesFor(records));
}

describe('enrichImportRecords, campos vazios', () => {
  it('completa o NCM e o codigo de barras do registro que chega sem os dois', async () => {
    const records = reportRecords(PRICE_REPORT);
    const { records: enriched } = await enrich(records);

    expect(records[0].candidate).not.toHaveProperty('ncm');
    expect(records[0].candidate).not.toHaveProperty('ean');
    expect(enriched[0].candidate).toEqual({ ...records[0].candidate, ncm: '94035000', ean: '7890000000017' });
    expect(validateCandidate(enriched[0].candidate).success).toBe(true);
  });

  it('acha a mesma linha pelo codigo com e sem zeros a esquerda', async () => {
    const records = [...reportRecords(PRICE_REPORT), ...reportRecords(STOCK_REPORT)];
    const { records: enriched } = await enrich(records);
    const codes = enriched.map((record) => record.candidate.systemCode);

    expect(codes).toEqual(['01620', '118114', '777777', '001620']);
    expect(enriched[0].candidate.ncm).toBe('94035000');
    expect(enriched[3].candidate.ncm).toBe('94035000');
    expect(enriched[3].candidate.ean).toBe('7890000000017');
  });

  it('completa so o NCM quando a base nao tem codigo de barras daquele codigo', async () => {
    const { records: enriched } = await enrich(reportRecords(PRICE_REPORT));

    expect(enriched[1].candidate.ncm).toBe('73211100');
    expect(enriched[1].candidate).not.toHaveProperty('ean');
    expect(enriched[1].enrichedFields).toEqual(['ncm']);
  });

  it('deixa o saldo de estoque completado e ainda recusado pela falta de preco', async () => {
    const { records: enriched } = await enrich(reportRecords(STOCK_REPORT));
    const { success, fieldErrors } = validateCandidate(enriched[0].candidate);

    expect(enriched[0].candidate.ncm).toBe('94035000');
    expect(success).toBe(false);
    expect(Object.keys(fieldErrors)).toEqual(['priceInCentavos']);
  });
});

describe('enrichImportRecords, o que o arquivo trouxe', () => {
  it('mantem o NCM e o codigo de barras do arquivo mesmo com outro valor na base', async () => {
    const record = listRecord({ codigo: '1620', nome: 'GUARDA ROUPA INVENTADO', preco: '10,00', ncm: '94036000', ean: '7890000000031' });
    const { records: enriched, summary } = await enrich([record]);

    expect(enriched[0]).toBe(record);
    expect(enriched[0].candidate).toEqual(expect.objectContaining({ ncm: '94036000', ean: '7890000000031' }));
    expect(enriched[0]).not.toHaveProperty('enrichedFields');
    expect(summary.found).toBe(1);
    expect(summary.enriched).toBe(0);
  });

  it('completa o campo que o arquivo trazia fora do contrato e tira o aviso so daquele campo', async () => {
    const record = listRecord({ codigo: '1620', nome: 'GUARDA ROUPA INVENTADO', preco: '10,00', ncm: '9403500', ean: '78900' });
    const { records: enriched, summary } = await enrich([record]);

    expect(record.candidateIssues.map((issue) => issue.code)).toEqual([
      ISSUE_EAN_UNEXPECTED_LENGTH,
      ISSUE_NCM_UNEXPECTED_FORMAT,
    ]);
    expect(enriched[0].candidate).toEqual(expect.objectContaining({ ncm: '94035000', ean: '7890000000017' }));
    expect(enriched[0].candidateIssues).toEqual([]);
    expect(enriched[0].raw).toEqual(record.raw);
    expect(summary.replacedInvalidByField).toEqual({ ncm: 1, ean: 1 });
  });

  it('mantem o aviso do campo que a base nao tem como completar', async () => {
    const record = listRecord({ codigo: '118114', nome: 'FOGAO INVENTADO', preco: '10,00', ean: '78900' });
    const { records: enriched } = await enrich([record]);

    expect(enriched[0].candidate.ncm).toBe('73211100');
    expect(enriched[0].candidate).not.toHaveProperty('ean');
    expect(enriched[0].candidateIssues.map((issue) => issue.field)).toEqual(['ean']);
  });

  it('nao muda nem bloqueia o registro cujo codigo esta fora da base', async () => {
    const records = reportRecords(PRICE_REPORT);
    const { records: enriched } = await enrich(records);

    expect(enriched[2]).toBe(records[2]);
    expect(enriched[2].candidate).not.toHaveProperty('ncm');
    expect(validateCandidate(enriched[2].candidate).success).toBe(true);
  });

  it('confere o valor da base pelo contrato antes de usa-lo', () => {
    const record = listRecord({ codigo: '1620', nome: 'GUARDA ROUPA INVENTADO', preco: '10,00' });
    const references = new Map([['1620', { systemCode: '1620', ncm: '9403.50.00', ean: '78900' }]]);
    const { records: enriched, summary } = enrichImportRecords([record], references);

    expect(enriched[0]).toBe(record);
    expect(summary.found).toBe(1);
    expect(summary.enriched).toBe(0);
  });

  it('nao toca o registro sem codigo e nao o conta como consultado', () => {
    const record = listRecord({ nome: 'MESA INVENTADA', preco: '10,00' });
    const { records: enriched, summary } = enrichImportRecords([record], new Map([['', { ncm: '94035000' }]]));

    expect(enriched[0]).toBe(record);
    expect(summary.lookedUp).toBe(0);
  });
});

describe('enrichImportRecords, a marca', () => {
  it('marca o registro com os campos que vieram da base, fora do candidato', async () => {
    const { records: enriched } = await enrich(reportRecords(PRICE_REPORT));

    expect(enriched[0].enrichedFields).toEqual(['ncm', 'ean']);
    expect(Object.keys(enriched[0].candidate)).not.toContain('enrichedFields');
    expect(enriched[2]).not.toHaveProperty('enrichedFields');
  });

  it('deixa o candidato completado dentro do contrato estrito do produto', async () => {
    const { records: enriched } = await enrich(reportRecords(PRICE_REPORT));
    const product = {
      ...enriched[0].candidate,
      id: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
    };

    expect(ProductSchema.safeParse(product).success).toBe(true);
    expect(ProductSchema.safeParse({ ...product, enrichedFields: ['ncm'] }).success).toBe(false);
  });

  it('nao altera os registros recebidos', async () => {
    const records = reportRecords(PRICE_REPORT);
    const before = structuredClone(records);

    await enrich(records);

    expect(records).toEqual(before);
  });
});

describe('enrichImportRecords, contagens', () => {
  it('conta consultados, achados, fora da base e completados por campo', async () => {
    const records = [...reportRecords(PRICE_REPORT), ...reportRecords(STOCK_REPORT)];
    const { summary } = await enrich(records);

    expect(summary).toEqual({
      recordCount: 4,
      lookedUp: 4,
      found: 3,
      notFound: 1,
      enriched: 3,
      gainedByField: { ncm: 3, ean: 2 },
      replacedInvalidByField: { ncm: 0, ean: 0 },
    });
  });

  it('com a base vazia, devolve os mesmos registros e nenhum achado', () => {
    const records = reportRecords(PRICE_REPORT);
    const { records: enriched, summary } = enrichImportRecords(records, new Map());

    enriched.forEach((record, index) => expect(record).toBe(records[index]));
    expect(summary).toEqual(expect.objectContaining({ lookedUp: 3, found: 0, notFound: 3, enriched: 0 }));
  });

  it('completa so NCM e codigo de barras', () => {
    expect(ENRICHABLE_FIELDS).toEqual(['ncm', 'ean']);
  });
});

describe('referenceCodesFor', () => {
  it('devolve os codigos distintos do lote, como vieram, sem o vazio', () => {
    const records = [
      ...reportRecords(PRICE_REPORT),
      ...reportRecords(STOCK_REPORT),
      ...reportRecords(PRICE_REPORT),
      listRecord({ nome: 'MESA INVENTADA', preco: '10,00' }),
    ];

    expect(referenceCodesFor(records)).toEqual(['01620', '118114', '777777', '001620']);
  });
});
