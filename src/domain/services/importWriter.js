import {
  CONFLICT_KIND_IDENTICAL,
  DECISION_REPLACE,
  DECISION_SKIP,
} from './importConflict.js';
import { candidateForRecord } from './importCorrection.js';
import { describeImportOrigin } from './importRecord.js';
import { blocksWriting } from './importReport.js';
import { getRecordReport } from './importReportIndex.js';
import { buildNewProduct, buildUpdatedProduct } from './productService.js';

/**
 * Gravacao do lote aprovado, em fatias transacionais.
 *
 * ## Por que fatia, e por que transacao
 *
 * Uma transacao unica para o lote inteiro nao sobrevive a uma cessao de turno: a
 * transacao do banco fecha sozinha quando o turno volta, e sem cessao de turno a
 * tela fica presa pelo tempo todo da gravacao. Ela tambem desfaz milhares de
 * gravacoes boas por causa de uma que falhou no fim.
 *
 * Escrita a escrita, sem transacao, sao tantas transacoes quantos registros, e o
 * custo por transacao domina o total.
 *
 * A fatia transacional resolve as duas coisas de uma vez, e tem uma consequencia
 * que vale mais que o desempenho: **o que foi gravado e sempre um trecho inicial
 * exato do lote**. Nenhuma fatia fica pela metade. E por isso que a frase na tela
 * pode dizer um numero verdadeiro, e que a retomada e so continuar de onde parou.
 *
 * ## O que acontece quando uma escrita falha
 *
 * A fatia da falha e desfeita inteira pelo proprio banco, a execucao para ali, e
 * o resultado diz quantos registros entraram, em qual registro parou e quantos
 * nao foram tentados. As falhas reais desta escrita — armazenamento cheio,
 * conexao fechada, gravacao abortada — atingem todo o resto do lote, entao
 * insistir nos registros seguintes so trocaria uma mensagem por milhares.
 *
 * O erro sobe como veio. A traducao para o texto que o usuario le acontece onde
 * ele le, com `describeStorageError`, e nao aqui.
 *
 * ## O que este modulo nao decide
 *
 * Nada sobre o conteudo do registro. Se ele pode ser gravado, quem responde e
 * `blocksWriting` sobre a entrada do relatorio; o que gravar vem de
 * `candidateForRecord`, que e o unico lugar que junta candidato e correcao; e a
 * escrita em si e o repositorio de produtos, com o contrato conferindo cada
 * registro antes de entrar.
 *
 * O repositorio entra como dependencia, e nao como import. Assim este modulo —
 * que e dominio — nao conhece a biblioteca de persistencia, e a suite pode
 * exercitar a sequencia inteira num ambiente sem IndexedDB.
 */

export const WRITE_SLICE_SIZE = 500;

/** Gravado como produto novo, com identificador proprio. */
export const WRITE_OUTCOME_CREATED = 'created';
/** Regravou um produto que ja existia, por decisao do usuario. */
export const WRITE_OUTCOME_REPLACED = 'replaced';
/** Nao gravado por decisao do usuario. */
export const WRITE_OUTCOME_SKIPPED = 'skipped';
/** Ja estava no catalogo, igual ao que o arquivo trouxe. */
export const WRITE_OUTCOME_ALREADY_IN_CATALOG = 'alreadyInCatalog';
/** Recusado pelo contrato, ou com conflito sem decisao. Nao grava. */
export const WRITE_OUTCOME_BLOCKED = 'blocked';

const COUNTER_BY_OUTCOME = new Map([
  [WRITE_OUTCOME_CREATED, 'created'],
  [WRITE_OUTCOME_REPLACED, 'replaced'],
  [WRITE_OUTCOME_SKIPPED, 'skipped'],
  [WRITE_OUTCOME_ALREADY_IN_CATALOG, 'alreadyInCatalog'],
  [WRITE_OUTCOME_BLOCKED, 'blocked'],
]);

function createCounts() {
  return {
    created: 0,
    replaced: 0,
    skipped: 0,
    alreadyInCatalog: 0,
    blocked: 0,
    notAttempted: 0,
    carried: 0,
  };
}

/**
 * O que acontece com um registro, decidido so a partir da entrada do relatorio.
 *
 * A ordem das perguntas e a ordem das garantias: o que o contrato recusou nunca
 * chega a escrita, e nenhuma decisao de conflito reverte isso. Depois vem o
 * registro que ja esta no catalogo igual ao do arquivo, que nao tem o que
 * decidir. Só entao a decisao do usuario e lida.
 */
export function planRecordWrite(entry) {
  if (!entry || blocksWriting(entry)) {
    return { outcome: WRITE_OUTCOME_BLOCKED, storedProduct: null };
  }

  const conflict = entry.conflict;

  if (conflict?.code?.kind === CONFLICT_KIND_IDENTICAL) {
    return { outcome: WRITE_OUTCOME_ALREADY_IN_CATALOG, storedProduct: conflict.code.storedProduct };
  }

  if (conflict?.decision === DECISION_SKIP) {
    return { outcome: WRITE_OUTCOME_SKIPPED, storedProduct: null };
  }

  if (conflict?.decision === DECISION_REPLACE && conflict.code?.storedProduct) {
    return { outcome: WRITE_OUTCOME_REPLACED, storedProduct: conflict.code.storedProduct };
  }

  return { outcome: WRITE_OUTCOME_CREATED, storedProduct: null };
}

function isWrite(outcome) {
  return outcome === WRITE_OUTCOME_CREATED || outcome === WRITE_OUTCOME_REPLACED;
}

function performWrite(repository, item, corrections) {
  const candidate = candidateForRecord(item.record, corrections);

  if (item.outcome === WRITE_OUTCOME_REPLACED) {
    return repository.updateProduct(buildUpdatedProduct(item.storedProduct, candidate));
  }

  return repository.createProduct(buildNewProduct(candidate));
}

/**
 * Conta tudo o que restou do lote a partir de uma posicao, para que nenhum
 * registro fique fora da soma quando a execucao para no meio.
 */
function tallyRemainder(counts, records, report, writtenIds, from) {
  for (let position = from; position < records.length; position += 1) {
    const record = records[position];

    if (writtenIds.has(record.recordId)) {
      counts.carried += 1;
      continue;
    }

    const { outcome } = planRecordWrite(getRecordReport(report, record.recordId));

    if (isWrite(outcome)) {
      counts.notAttempted += 1;
    } else {
      counts[COUNTER_BY_OUTCOME.get(outcome)] += 1;
    }
  }

  return counts;
}

/**
 * Grava o lote e devolve o resultado por categoria.
 *
 * `writtenIds` guarda os registros que entraram, e e por ele que uma segunda
 * chamada sabe o que nao repetir — nao por uma posicao de parada. A diferenca
 * importa nos dois sentidos: entre a falha e a retomada o usuario pode ter
 * resolvido um conflito que ficou para tras, e esse registro precisa entrar na
 * segunda passagem; e um lote gravado inteiro, cujo ultimo conflito so foi
 * decidido depois, nao pode gravar de novo o que ja esta no catalogo.
 *
 * Por isso o conjunto volta sempre, e nao so quando a execucao parou no meio.
 */
export async function writeImportBatch(records, options = {}) {
  const {
    report,
    corrections = {},
    sliceSize = WRITE_SLICE_SIZE,
    repository,
    writtenIds = new Set(),
    shouldStop = () => false,
    onProgress,
  } = options;

  const counts = createCounts();
  const total = records.length;
  let position = 0;

  while (position < total) {
    if (shouldStop()) {
      return {
        ...tallyRemainder(counts, records, report, writtenIds, position),
        total,
        stopped: true,
        failure: null,
        writtenIds,
      };
    }

    const end = Math.min(position + sliceSize, total);
    const slice = planSlice(records, report, writtenIds, position, end);
    let current = null;

    if (slice.writes.length > 0) {
      try {
        await repository.runProductsTransaction(async () => {
          for (const item of slice.writes) {
            current = item;

            await performWrite(repository, item, corrections);
          }
        });
      } catch (error) {
        return {
          ...tallyRemainder(counts, records, report, writtenIds, position),
          total,
          stopped: false,
          failure: {
            recordId: current?.record.recordId ?? null,
            index: current?.index ?? position,
            origin: current ? describeImportOrigin(current.record) : null,
            error,
          },
          writtenIds,
        };
      }

      for (const item of slice.writes) {
        writtenIds.add(item.record.recordId);
        counts[COUNTER_BY_OUTCOME.get(item.outcome)] += 1;
      }
    }

    mergeCounts(counts, slice.counts);
    position = end;
    onProgress?.(position, total);
  }

  return { ...counts, total, stopped: false, failure: null, writtenIds };
}

function planSlice(records, report, writtenIds, from, to) {
  const counts = createCounts();
  const writes = [];

  for (let position = from; position < to; position += 1) {
    const record = records[position];

    if (writtenIds.has(record.recordId)) {
      counts.carried += 1;
      continue;
    }

    const { outcome, storedProduct } = planRecordWrite(getRecordReport(report, record.recordId));

    if (isWrite(outcome)) {
      writes.push({ record, index: position, outcome, storedProduct });
    } else {
      counts[COUNTER_BY_OUTCOME.get(outcome)] += 1;
    }
  }

  return { counts, writes };
}

function mergeCounts(counts, slice) {
  for (const key of Object.keys(slice)) {
    counts[key] += slice[key];
  }

  return counts;
}
