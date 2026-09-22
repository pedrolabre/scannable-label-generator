// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { ProductSchema } from '../schemas/productSchema.js';

import {
  CONFLICT_KIND_CATALOG,
  DECISION_KEEP_BOTH,
  DECISION_REPLACE,
  DECISION_SKIP,
  conflictFor,
  withDecision,
} from './importConflict.js';
import { indexCatalog } from './importConflictIndex.js';
import { candidateForRecord } from './importCorrection.js';
import { createImportRecord } from './importRecord.js';
import { describeRecord } from './importReport.js';
import { createImportReport, pushRecordReport } from './importReportIndex.js';
import { validateCandidate } from './importValidation.js';
import {
  WRITE_OUTCOME_ALREADY_IN_CATALOG,
  WRITE_OUTCOME_BLOCKED,
  WRITE_OUTCOME_CREATED,
  WRITE_OUTCOME_REPLACED,
  WRITE_OUTCOME_SKIPPED,
  planRecordWrite,
  writeImportBatch,
} from './importWriter.js';

/**
 * Todo registro e todo produto deste arquivo sao escritos a mao, com valores
 * inventados. Nenhum valor vem de documento real.
 *
 * O repositorio e substituido por uma implementacao de teste porque o ambiente da
 * suite nao tem IndexedDB. Ela imita as duas coisas que importam para este
 * modulo: o contrato conferindo cada produto antes de gravar, e a transacao
 * desfazendo a fatia inteira quando uma escrita falha.
 */
function record(index, candidate) {
  return {
    ...createImportRecord({
      fileName: 'planilha-inventada.csv',
      fileIndex: 0,
      format: 'csv',
      index,
      raw: {},
    }),
    candidate,
    candidateIssues: [],
  };
}

function stored(fields, position = 1) {
  return {
    id: `${String(position).padStart(8, '0')}-0000-4000-8000-000000000000`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...fields,
  };
}

function fakeRepository({ failAtWrite = null, validate = true } = {}) {
  const repository = {
    written: [],
    transactions: 0,
    attempts: 0,

    async runProductsTransaction(write) {
      repository.transactions += 1;

      const committed = repository.written.length;

      try {
        await write();
      } catch (error) {
        repository.written.length = committed;

        throw error;
      }
    },

    async createProduct(product) {
      return repository.save(product);
    },

    async updateProduct(product) {
      return repository.save(product);
    },

    save(product) {
      repository.attempts += 1;

      if (repository.attempts === failAtWrite) {
        throw Object.assign(new Error('sem espaço'), { name: 'QuotaExceededError' });
      }

      const saved = validate ? ProductSchema.parse(product) : product;

      repository.written.push(saved);

      return saved;
    },
  };

  return repository;
}

/** Relatorio do lote, com os conflitos que o chamador quiser embutir. */
function reportFor(records, { corrections = {}, conflicts = new Map() } = {}) {
  const report = createImportReport();

  records.forEach((item, index) => {
    pushRecordReport(
      report,
      describeRecord(
        item,
        validateCandidate(candidateForRecord(item, corrections)),
        index,
        corrections[item.recordId] ?? null,
        conflicts.get(item.recordId) ?? null,
      ),
    );
  });

  return report;
}

function catalogConflict(record, storedProduct, decision = null) {
  const index = { catalog: indexCatalog([storedProduct]), codeGroups: new Map(), nameGroups: new Map() };
  const conflict = conflictFor(index, record, record.candidate, record.source.index);

  return withDecision(conflict, decision);
}

const UM = { systemCode: 'INV-1', displayName: 'Produto inventado um', priceInCentavos: 1250 };
const DOIS = { systemCode: 'INV-2', displayName: 'Produto inventado dois', priceInCentavos: 990 };

describe('writeImportBatch', () => {
  it('grava como produto novo todo registro que o relatorio libera', async () => {
    const records = [record(0, UM), record(1, DOIS)];
    const repository = fakeRepository();
    const report = reportFor(records);

    const result = await writeImportBatch(records, { report, repository });

    expect(planRecordWrite(report.entries.get('0:0')).outcome).toBe(WRITE_OUTCOME_CREATED);
    expect(result).toMatchObject({ created: 2, replaced: 0, blocked: 0, notAttempted: 0, total: 2 });
    expect(result.failure).toBeNull();
    expect(repository.written.map((product) => product.systemCode)).toEqual(['INV-1', 'INV-2']);
    expect(repository.written[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(repository.written[0].createdAt).toBe(repository.written[0].updatedAt);
  });

  it('registro recusado pelo contrato nao chega a escrita, mesmo com a decisao tomada', async () => {
    const recusado = record(0, { systemCode: 'INV/4', displayName: 'Produto inventado quatro' });
    const records = [recusado, record(1, DOIS)];
    const gravado = stored({ systemCode: 'INV/4', displayName: 'Outro nome inventado', priceInCentavos: 10 });

    const conflicts = new Map([
      [recusado.recordId, catalogConflict(recusado, gravado, DECISION_REPLACE)],
    ]);

    const report = reportFor(records, { conflicts });
    const repository = fakeRepository();

    const result = await writeImportBatch(records, { report, repository });

    expect(planRecordWrite(report.entries.get('0:0')).outcome).toBe(WRITE_OUTCOME_BLOCKED);
    expect(result).toMatchObject({ created: 1, replaced: 0, blocked: 1 });
    expect(repository.written).toHaveLength(1);
    expect(repository.written[0].systemCode).toBe('INV-2');
  });

  it('grava o nome corrigido pelo usuario, e nao o que veio do arquivo', async () => {
    const records = [record(0, { ...UM, displayName: 'Nome comprido que veio do arquivo' })];
    const corrections = { '0:0': { displayName: 'Nome curto escolhido por mim' } };
    const repository = fakeRepository();

    await writeImportBatch(records, {
      report: reportFor(records, { corrections }),
      corrections,
      repository,
    });

    expect(repository.written[0].displayName).toBe('Nome curto escolhido por mim');
  });

  it('substituir regrava o produto do catalogo mantendo identificador e data de criacao', async () => {
    const registro = record(0, UM);
    const gravado = stored({ ...UM, priceInCentavos: 1 });
    const conflicts = new Map([[registro.recordId, catalogConflict(registro, gravado, DECISION_REPLACE)]]);
    const report = reportFor([registro], { conflicts });
    const repository = fakeRepository();

    const result = await writeImportBatch([registro], { report, repository });

    expect(conflicts.get('0:0').code.kind).toBe(CONFLICT_KIND_CATALOG);
    expect(planRecordWrite(report.entries.get('0:0')).outcome).toBe(WRITE_OUTCOME_REPLACED);
    expect(result).toMatchObject({ created: 0, replaced: 1 });
    expect(repository.written[0]).toMatchObject({
      id: gravado.id,
      createdAt: gravado.createdAt,
      priceInCentavos: 1250,
    });
    expect(repository.written[0].updatedAt).not.toBe(gravado.updatedAt);
  });

  it('pular por decisao nao grava, e gravar como novo grava', async () => {
    const pulado = record(0, UM);
    const novo = record(1, DOIS);
    const gravadoUm = stored({ ...UM, priceInCentavos: 1 }, 1);
    const gravadoDois = stored({ ...DOIS, priceInCentavos: 2 }, 2);

    const conflicts = new Map([
      [pulado.recordId, catalogConflict(pulado, gravadoUm, DECISION_SKIP)],
      [novo.recordId, catalogConflict(novo, gravadoDois, DECISION_KEEP_BOTH)],
    ]);

    const records = [pulado, novo];
    const report = reportFor(records, { conflicts });
    const repository = fakeRepository();

    const result = await writeImportBatch(records, { report, repository });

    expect(planRecordWrite(report.entries.get('0:0')).outcome).toBe(WRITE_OUTCOME_SKIPPED);
    expect(result).toMatchObject({ created: 1, skipped: 1, replaced: 0 });
    expect(repository.written.map((product) => product.systemCode)).toEqual(['INV-2']);
  });

  it('registro identico ao que ja esta no catalogo nao grava de novo, e e contado a parte', async () => {
    const registro = record(0, UM);
    const conflicts = new Map([[registro.recordId, catalogConflict(registro, stored(UM))]]);
    const report = reportFor([registro], { conflicts });
    const repository = fakeRepository();

    const result = await writeImportBatch([registro], { report, repository });

    expect(planRecordWrite(report.entries.get('0:0')).outcome).toBe(WRITE_OUTCOME_ALREADY_IN_CATALOG);
    expect(result).toMatchObject({ alreadyInCatalog: 1, created: 0 });
    expect(repository.written).toHaveLength(0);
  });
});

describe('falha no meio do lote', () => {
  function batchOf(size) {
    const records = new Array(size);

    for (let position = 0; position < size; position += 1) {
      records[position] = record(position, {
        systemCode: `INV-${position}`,
        displayName: `Produto inventado ${position}`,
        priceInCentavos: 100 + position,
      });
    }

    return records;
  }

  it('desfaz a fatia da falha, mantem as anteriores e para ali', async () => {
    const records = batchOf(10);
    const report = reportFor(records);
    const repository = fakeRepository({ failAtWrite: 6 });

    const result = await writeImportBatch(records, { report, repository, sliceSize: 4 });

    // A sexta escrita esta na segunda fatia, que volta inteira: sobram as quatro
    // da primeira, e nenhuma metade de fatia fica no catalogo.
    expect(repository.written.map((product) => product.systemCode)).toEqual([
      'INV-0',
      'INV-1',
      'INV-2',
      'INV-3',
    ]);
    expect(result).toMatchObject({ created: 4, notAttempted: 6, total: 10 });
    expect(result.failure).toMatchObject({ recordId: '0:5', index: 5 });
    expect(result.failure.origin).toBe('planilha-inventada.csv, linha 7');
    expect(result.failure.error.name).toBe('QuotaExceededError');
    expect(result.writtenIds.size).toBe(4);
  });

  it('a chamada seguinte continua do primeiro registro que nao entrou', async () => {
    const records = batchOf(10);
    const report = reportFor(records);
    const failing = fakeRepository({ failAtWrite: 6 });
    const first = await writeImportBatch(records, { report, repository: failing, sliceSize: 4 });

    const repository = fakeRepository();
    const second = await writeImportBatch(records, {
      report,
      repository,
      sliceSize: 4,
      writtenIds: first.writtenIds,
    });

    expect(second).toMatchObject({ created: 6, carried: 4, notAttempted: 0 });
    expect(second.failure).toBeNull();
    expect(repository.written.map((product) => product.systemCode)).toEqual([
      'INV-4',
      'INV-5',
      'INV-6',
      'INV-7',
      'INV-8',
      'INV-9',
    ]);
  });

  it('interromper para entre fatias, sem deixar fatia pela metade', async () => {
    const records = batchOf(10);
    const report = reportFor(records);
    const repository = fakeRepository();
    let slices = 0;

    const result = await writeImportBatch(records, {
      report,
      repository,
      sliceSize: 4,
      onProgress: () => {
        slices += 1;
      },
      shouldStop: () => slices >= 2,
    });

    expect(result.stopped).toBe(true);
    expect(result).toMatchObject({ created: 8, notAttempted: 2 });
    expect(repository.transactions).toBe(2);
    expect(repository.written).toHaveLength(8);
  });

  // O limite de tempo e ampliado so aqui: montar e gravar duzentos mil produtos
  // e o custo dominante e gerar um identificador por produto. E o unico teste
  // do arquivo que e longo por natureza, entao o limite padrao continua valendo
  // para todos os outros.
  //
  // O limite anterior media a duracao deste caso quase colada nele, e quem o
  // estourava nao era o caso: era a maquina, quando os outros arquivos da suite
  // correm ao mesmo tempo. Um limite que depende de quantos vizinhos rodam
  // junto nao prova nada sobre o codigo — so avisa que o computador estava
  // ocupado. O dobro devolve a folga.
  it('grava centenas de milhares de registros em fatias, uma transacao por fatia', async () => {
    const total = 200_000;
    const sliceSize = 500;
    const records = batchOf(total);
    const report = reportFor(records);
    const repository = fakeRepository({ validate: false });

    const result = await writeImportBatch(records, { report, repository, sliceSize });

    expect(result).toMatchObject({ created: total, notAttempted: 0, blocked: 0, total });
    expect(repository.transactions).toBe(total / sliceSize);
    expect(repository.written).toHaveLength(total);
  }, 60_000);
});
