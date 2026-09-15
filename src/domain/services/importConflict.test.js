import { describe, expect, it } from 'vitest';

import {
  CONFLICT_KIND_BATCH,
  CONFLICT_KIND_CATALOG,
  CONFLICT_KIND_IDENTICAL,
  DECISION_KEEP_BOTH,
  DECISION_REPLACE,
  DECISION_SKIP,
  availableDecisions,
  conflictFor,
  isConflictPending,
  nameKeyFor,
  summarizeConflicts,
  withDecision,
} from './importConflict.js';
import {
  detectImportConflicts,
  indexCatalog,
  updateNameGroups,
} from './importConflictIndex.js';
import { candidateForRecord } from './importCorrection.js';
import { createImportRecord } from './importRecord.js';
import {
  RECORD_STATUS_ATTENTION,
  RECORD_STATUS_PENDING,
  REPORT_REASON_DUPLICATE_IDENTICAL,
  REPORT_REASON_DUPLICATE_IN_BATCH,
  REPORT_REASON_DUPLICATE_IN_CATALOG,
  REPORT_REASON_DUPLICATE_NAME,
  blocksWriting,
  describeRecord,
} from './importReport.js';
import {
  createImportReport,
  pushRecordReport,
  rebuildReportIndex,
  writableCount,
} from './importReportIndex.js';
import { validateCandidate } from './importValidation.js';

/**
 * Todo registro e todo produto deste arquivo sao escritos a mao, com valores
 * inventados. Nenhum valor vem de documento real.
 *
 * Os registros sao montados com `candidate` direto, sem passar pelo mapeamento:
 * a deteccao de codigo repetido nao sabe de onde o candidato veio, e fixar o
 * candidato deixa o caso do teste legivel em uma linha.
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

let storedCounter = 0;

function stored(fields) {
  storedCounter += 1;

  return {
    id: `${String(storedCounter).padStart(8, '0')}-0000-4000-8000-000000000000`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...fields,
  };
}

/**
 * O mesmo encadeamento que o store faz: confere o lote, procura codigo repetido
 * e leva os conflitos encontrados as entradas que ja existiam.
 */
async function checkBatch(records, catalogProducts = [], corrections = {}) {
  const report = createImportReport();

  records.forEach((item, index) => {
    pushRecordReport(
      report,
      describeRecord(item, validateCandidate(candidateForRecord(item, corrections)), index),
    );
  });

  const conflicts = new Map();

  const index = await detectImportConflicts(records, {
    catalog: indexCatalog(catalogProducts),
    corrections,
    onConflict: (item, conflict) => {
      conflicts.set(item.recordId, conflict);
    },
  });

  for (const [recordId, conflict] of conflicts) {
    const entry = report.entries.get(recordId);
    const item = records[entry.index];

    report.entries.set(
      recordId,
      describeRecord(
        item,
        validateCandidate(candidateForRecord(item, corrections)),
        entry.index,
        null,
        conflict,
      ),
    );
  }

  return { report: rebuildReportIndex(report), conflicts, index };
}

const PRODUTO_UM = { systemCode: 'INV-1', displayName: 'Produto inventado um', priceInCentavos: 1250 };
const PRODUTO_DOIS = { systemCode: 'INV-2', displayName: 'Produto inventado dois', priceInCentavos: 990 };

describe('codigo repetido dentro do lote', () => {
  it('os dois registros do mesmo codigo esperam decisao, e nenhum dos dois grava', async () => {
    const records = [
      record(0, { ...PRODUTO_UM, displayName: 'Produto de terca' }),
      record(1, { ...PRODUTO_UM, displayName: 'Produto de quarta' }),
    ];

    const { report, conflicts } = await checkBatch(records);

    expect(conflicts.size).toBe(2);

    for (const recordId of ['0:0', '0:1']) {
      const conflict = conflicts.get(recordId);
      const entry = report.entries.get(recordId);

      expect(conflict.code).toMatchObject({ kind: CONFLICT_KIND_BATCH, batchCount: 2, storedProduct: null });
      expect(availableDecisions(conflict)).toEqual([DECISION_SKIP, DECISION_KEEP_BOTH]);
      expect(isConflictPending(conflict)).toBe(true);
      expect(entry.status).toBe(RECORD_STATUS_PENDING);
      expect(entry.reasons).toContain(REPORT_REASON_DUPLICATE_IN_BATCH);
      expect(blocksWriting(entry)).toBe(true);
    }

    expect(report.pendingCount).toBe(2);
    expect(writableCount(report)).toBe(0);
  });

  it('a decisao de um registro libera so aquele registro', async () => {
    const records = [
      record(0, { ...PRODUTO_UM, displayName: 'Produto de terca' }),
      record(1, { ...PRODUTO_UM, displayName: 'Produto de quarta' }),
    ];

    const { report, conflicts } = await checkBatch(records);
    const decided = withDecision(conflicts.get('0:0'), DECISION_KEEP_BOTH);
    const entry = describeRecord(records[0], validateCandidate(records[0].candidate), 0, null, decided);

    expect(isConflictPending(decided)).toBe(false);
    expect(entry.status).toBe(RECORD_STATUS_ATTENTION);
    expect(entry.reasons).toContain(REPORT_REASON_DUPLICATE_IN_BATCH);
    expect(blocksWriting(entry)).toBe(false);
    expect(blocksWriting(report.entries.get('0:1'))).toBe(true);
  });

  it('codigo distinto no lote inteiro nao deixa grupo vivo no indice', async () => {
    const { report, conflicts, index } = await checkBatch([
      record(0, PRODUTO_UM),
      record(1, PRODUTO_DOIS),
    ]);

    expect(conflicts.size).toBe(0);
    expect(index.codeGroups.size).toBe(0);
    expect(index.nameGroups.size).toBe(0);
    expect(writableCount(report)).toBe(2);
  });
});

describe('codigo repetido contra o catalogo', () => {
  it('preco diferente do gravado pede decisao, com o produto do catalogo a vista', async () => {
    const gravado = stored({ ...PRODUTO_UM, priceInCentavos: 1100 });
    const records = [record(0, PRODUTO_UM)];

    const { report, conflicts } = await checkBatch(records, [gravado]);
    const conflict = conflicts.get('0:0');

    expect(conflict.code.kind).toBe(CONFLICT_KIND_CATALOG);
    expect(conflict.code.storedProduct).toBe(gravado);
    expect(availableDecisions(conflict)).toEqual([
      DECISION_REPLACE,
      DECISION_SKIP,
      DECISION_KEEP_BOTH,
    ]);
    expect(report.entries.get('0:0').reasons).toContain(REPORT_REASON_DUPLICATE_IN_CATALOG);
    expect(report.pendingCount).toBe(1);
  });

  it('registro identico ao produto gravado nao pergunta nada e nao bloqueia', async () => {
    const gravado = stored(PRODUTO_UM);
    const { report, conflicts } = await checkBatch([record(0, { ...PRODUTO_UM })], [gravado]);
    const conflict = conflicts.get('0:0');
    const entry = report.entries.get('0:0');

    expect(conflict.code.kind).toBe(CONFLICT_KIND_IDENTICAL);
    expect(conflict.name).toBeNull();
    expect(availableDecisions(conflict)).toEqual([]);
    expect(isConflictPending(conflict)).toBe(false);
    expect(entry.status).toBe(RECORD_STATUS_ATTENTION);
    expect(entry.reasons).toEqual([REPORT_REASON_DUPLICATE_IDENTICAL]);
    expect(blocksWriting(entry)).toBe(false);
    expect(report.pendingCount).toBe(0);
  });

  it('campo opcional ausente e campo vazio contam como a mesma coisa na comparacao', async () => {
    const gravado = stored(PRODUTO_UM);
    const { conflicts } = await checkBatch(
      [record(0, { ...PRODUTO_UM, description: '', category: undefined })],
      [gravado],
    );

    expect(conflicts.get('0:0').code.kind).toBe(CONFLICT_KIND_IDENTICAL);
  });

  it('conflito com o catalogo tem precedencia sobre o do lote, e mostra os dois numeros', async () => {
    const gravado = stored({ ...PRODUTO_UM, priceInCentavos: 1 });
    const { conflicts } = await checkBatch(
      [record(0, PRODUTO_UM), record(1, { ...PRODUTO_UM, priceInCentavos: 1300 })],
      [gravado],
    );

    expect(conflicts.get('0:0').code).toMatchObject({
      kind: CONFLICT_KIND_CATALOG,
      batchCount: 2,
    });
  });
});

describe('colisao de nome encurtado', () => {
  const MESMO_NOME = 'Produto inventado com nome repetido';

  it('avisa e nao impede nada', async () => {
    const records = [
      record(0, { ...PRODUTO_UM, displayName: MESMO_NOME }),
      record(1, { ...PRODUTO_DOIS, displayName: MESMO_NOME }),
    ];

    const { report, conflicts } = await checkBatch(records);
    const entry = report.entries.get('0:0');

    expect(conflicts.get('0:0').name).toMatchObject({ inBatch: true, inCatalog: false, batchCount: 2 });
    expect(conflicts.get('0:0').code).toBeNull();
    expect(entry.status).toBe(RECORD_STATUS_ATTENTION);
    expect(entry.reasons).toEqual([REPORT_REASON_DUPLICATE_NAME]);
    expect(blocksWriting(entry)).toBe(false);
    expect(writableCount(report)).toBe(2);
  });

  it('acentuacao e caixa nao escondem a colisao', async () => {
    const { conflicts } = await checkBatch([
      record(0, { ...PRODUTO_UM, displayName: 'Pão Francês' }),
      record(1, { ...PRODUTO_DOIS, displayName: 'PAO FRANCES' }),
    ]);

    expect(conflicts.size).toBe(2);
  });

  it('nome que ja existe no catalogo tambem colide', async () => {
    const { conflicts } = await checkBatch(
      [record(0, { ...PRODUTO_DOIS, displayName: MESMO_NOME })],
      [stored({ ...PRODUTO_UM, displayName: MESMO_NOME })],
    );

    expect(conflicts.get('0:0').name).toMatchObject({ inBatch: false, inCatalog: true });
  });

  it('corrigir o nome de um dos dois dissolve a colisao dos dois, sem varrer o lote', async () => {
    const records = [
      record(0, { ...PRODUTO_UM, displayName: MESMO_NOME }),
      record(1, { ...PRODUTO_DOIS, displayName: MESMO_NOME }),
    ];

    const { index } = await checkBatch(records);
    const corrections = { '0:0': { displayName: 'Nome inventado corrigido' } };

    const affected = updateNameGroups(
      index,
      0,
      nameKeyFor(records[0].candidate),
      nameKeyFor(candidateForRecord(records[0], corrections)),
    );

    expect(affected).toEqual([0, 1]);

    for (const position of affected) {
      expect(
        conflictFor(index, records[position], candidateForRecord(records[position], corrections), position),
      ).toBeNull();
    }
  });

  it('desfazer a correcao devolve o registro ao grupo, e a colisao volta', async () => {
    const records = [
      record(0, { ...PRODUTO_UM, displayName: MESMO_NOME }),
      record(1, { ...PRODUTO_DOIS, displayName: MESMO_NOME }),
    ];

    const { index } = await checkBatch(records);
    const original = nameKeyFor(records[0].candidate);
    const corrigido = nameKeyFor({ displayName: 'Nome inventado corrigido' });

    updateNameGroups(index, 0, original, corrigido);

    const voltou = updateNameGroups(index, 0, corrigido, original);

    expect(voltou).toEqual([0, 1]);

    for (const position of [0, 1]) {
      expect(
        conflictFor(index, records[position], records[position].candidate, position).name,
      ).toMatchObject({ inBatch: true, batchCount: 2 });
    }
  });

  it('a colisao contra o catalogo aparece mesmo depois de uma edicao manual', async () => {
    const records = [record(0, PRODUTO_UM), record(1, PRODUTO_DOIS)];
    const { index } = await checkBatch(records, [stored({ ...PRODUTO_UM, systemCode: 'INV-9', displayName: 'Nome ja gravado' })]);
    const corrections = { '0:1': { displayName: 'Nome já gravado' } };

    updateNameGroups(
      index,
      1,
      nameKeyFor(records[1].candidate),
      nameKeyFor(candidateForRecord(records[1], corrections)),
    );

    const conflict = conflictFor(index, records[1], candidateForRecord(records[1], corrections), 1);

    expect(conflict.name).toMatchObject({ inBatch: false, inCatalog: true });
  });
});

describe('retrato dos conflitos', () => {
  it('separa pendente, decidido e identico', async () => {
    const { conflicts } = await checkBatch(
      [
        record(0, PRODUTO_UM),
        record(1, PRODUTO_DOIS),
        record(2, { systemCode: 'INV-3', displayName: 'Produto inventado tres', priceInCentavos: 100 }),
      ],
      [
        stored({ ...PRODUTO_UM, priceInCentavos: 1 }),
        stored(PRODUTO_DOIS),
        stored({ systemCode: 'INV-3', displayName: 'Outro nome inventado', priceInCentavos: 100 }),
      ],
    );

    conflicts.set('0:2', withDecision(conflicts.get('0:2'), DECISION_SKIP));

    const summary = summarizeConflicts(conflicts);

    expect(summary).toMatchObject({
      total: 3,
      pending: 1,
      pendingInCatalog: 1,
      pendingInBatch: 0,
      identical: 1,
      toSkip: 1,
      toReplace: 0,
    });
  });
});

describe('lote grande', () => {
  // O limite de tempo e ampliado so aqui: montar duzentos mil registros e
  // varre-los em fatias ja passou de tres segundos com a maquina ocupada, e o
  // limite padrao nao deixa margem suficiente para o momento em que a suite
  // roda inteira. E o unico teste do arquivo que e longo por natureza, entao o
  // limite padrao continua valendo para todos os outros.
  it('agrupa centenas de milhares de registros em fatias e guarda so o grupo repetido', async () => {
    const total = 200_000;
    const records = new Array(total);

    for (let position = 0; position < total; position += 1) {
      records[position] = record(position, {
        systemCode: `INV-${position}`,
        displayName: `Produto inventado ${position}`,
        priceInCentavos: 100,
      });
    }

    // Um unico par repetido no meio de duzentos mil: e o caso comum de um lote
    // grande, e e o que a poda do indice precisa deixar em pe.
    records[199_999].candidate = { ...records[199_999].candidate, systemCode: 'INV-7' };

    const conflicts = new Map();
    let progressCalls = 0;

    const index = await detectImportConflicts(records, {
      catalog: indexCatalog([]),
      onConflict: (item, conflict) => {
        conflicts.set(item.recordId, conflict);
      },
      onProgress: () => {
        progressCalls += 1;
      },
    });

    expect(progressCalls).toBe(total / 2000);
    expect(index.codeGroups.size).toBe(1);
    expect(index.nameGroups.size).toBe(0);
    expect([...conflicts.keys()]).toEqual(['0:7', '0:199999']);
    expect(conflicts.get('0:7').code.batchCount).toBe(2);
  }, 30_000);
});
