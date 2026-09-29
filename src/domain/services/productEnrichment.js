import { ProductSchema } from '../schemas/productSchema.js';

import { comparableCode } from './catalogCompletion.js';
import { NO_MAPPING_ISSUES } from './productCandidateIssue.js';

/**
 * Enriquecimento do lote importado pela base de referencia.
 *
 * Os relatorios do ERP nao trazem NCM nem codigo de barras, e a planilha
 * cadastral, guardada como base de referencia, traz os dois por codigo. Aqui o
 * registro ja traduzido encontra a linha da base do seu codigo e ganha o que
 * lhe falta, antes da conferencia.
 *
 * A regra cabe em quatro frases:
 *
 * - so o campo vazio no candidato e completado; o valor que o arquivo trouxe
 *   fica como veio, mesmo quando a base diz outro;
 * - o valor da base passa pelo contrato do produto antes de entrar;
 * - o campo que o arquivo trazia fora do contrato, e que por isso a traducao
 *   deixou vazio com um aviso, e completado pela base, e o aviso daquele campo
 *   sai: ele descrevia um valor que nao sera mais o gravado;
 * - nenhum registro e criado, recusado ou descartado por causa da base.
 *
 * O registro completado leva `enrichedFields`, com os campos que vieram da
 * base. A marca fica no registro, ao lado de `raw` e `candidateIssues`, e nunca
 * no candidato: o contrato do produto e estrito, e o produto gravado e montado
 * so a partir do candidato.
 *
 * O mapa recebido e o da busca em lista da base: o codigo como foi pedido para
 * o NCM e o codigo de barras da linha. O dominio nao consulta armazenamento;
 * quem chama faz a busca e entrega o mapa pronto.
 *
 * Funcao pura: nao toca em armazenamento e nao le relogio.
 */

export const ENRICHABLE_FIELDS = Object.freeze(['ncm', 'ean']);

function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function codeOf(record) {
  const code = record.candidate?.systemCode;

  return typeof code === 'string' ? code : '';
}

function referenceValue(reference, field) {
  if (!reference || isEmpty(reference[field])) {
    return undefined;
  }

  const parsed = ProductSchema.shape[field].safeParse(reference[field]);

  return parsed.success ? parsed.data : undefined;
}

function emptyCounts() {
  return Object.fromEntries(ENRICHABLE_FIELDS.map((field) => [field, 0]));
}

function emptySummary(recordCount) {
  return {
    recordCount,
    lookedUp: 0,
    found: 0,
    notFound: 0,
    enriched: 0,
    gainedByField: emptyCounts(),
    replacedInvalidByField: emptyCounts(),
  };
}

/**
 * Codigos distintos do lote, como vieram, para a busca em lista. Registro sem
 * codigo nao entra: nao ha o que procurar.
 */
export function referenceCodesFor(records) {
  const codes = new Set();

  for (const record of records) {
    const code = codeOf(record);

    if (comparableCode(code) !== '') {
      codes.add(code);
    }
  }

  return [...codes];
}

/**
 * Registros com os campos vazios completados pela base, e as contagens.
 *
 * O registro que nao ganha nada volta como estava, o mesmo objeto. Por campo,
 * o resumo conta quantos registros o ganharam e, desses, quantos tinham no
 * arquivo um valor fora do contrato.
 */
export function enrichImportRecords(records, references = new Map()) {
  const summary = emptySummary(records.length);
  const enriched = [];

  for (const record of records) {
    const code = codeOf(record);

    if (comparableCode(code) === '') {
      enriched.push(record);
      continue;
    }

    summary.lookedUp += 1;

    const reference = references.get(code);

    if (!reference) {
      summary.notFound += 1;
      enriched.push(record);
      continue;
    }

    summary.found += 1;

    const gained = {};
    const issues = record.candidateIssues ?? NO_MAPPING_ISSUES;

    for (const field of ENRICHABLE_FIELDS) {
      if (!isEmpty(record.candidate[field])) {
        continue;
      }

      const value = referenceValue(reference, field);

      if (value === undefined) {
        continue;
      }

      gained[field] = value;
      summary.gainedByField[field] += 1;

      if (issues.some((issue) => issue.field === field)) {
        summary.replacedInvalidByField[field] += 1;
      }
    }

    const fields = Object.keys(gained);

    if (fields.length === 0) {
      enriched.push(record);
      continue;
    }

    const remaining = issues.filter((issue) => !fields.includes(issue.field));

    summary.enriched += 1;
    enriched.push({
      ...record,
      candidate: { ...record.candidate, ...gained },
      candidateIssues: remaining.length === 0 ? NO_MAPPING_ISSUES : remaining,
      enrichedFields: fields,
    });
  }

  return { records: enriched, summary };
}
