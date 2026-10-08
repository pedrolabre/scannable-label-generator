import { comparableCode, readFileValue } from './catalogCompletion.js';
import { IMPORT_FORMAT_XML } from './importRecord.js';

/**
 * Linhas da base de referencia a partir dos registros ja traduzidos pelo
 * importador.
 *
 * A base guarda, por codigo, o NCM e o codigo de barras que a planilha
 * cadastral traz, para completar depois o produto que chegar sem eles. Ela nao
 * e catalogo: nenhuma linha vira produto, e o que ela guarda e so o que serve
 * para essa busca — o codigo como veio, o codigo comparavel e os dois campos.
 *
 * ## O que entra
 *
 * So o valor aceito pelo contrato do produto, lido pela mesma regra do
 * Completar dados: o NCM de sete digitos e o codigo de barras fora do padrao,
 * que a traducao ja marca com aviso, ficam fora e sao contados. A linha que fica
 * sem NCM e sem codigo de barras aproveitaveis nao entra, e o mesmo vale para a
 * linha sem codigo valido.
 *
 * ## Codigo repetido
 *
 * A chave e o codigo comparavel, entao `01620` e `1620` sao o mesmo codigo. O
 * que aparece primeiro fica, mesmo sem dado aproveitavel, e os seguintes sao so
 * contados: escolher entre duas linhas do mesmo codigo seria adivinhar qual a
 * planilha quis dizer. E a mesma regra do Completar dados.
 *
 * Funcao pura: nao toca em armazenamento e nao le relogio.
 */

function mentionsReferenceField(record) {
  if (record.candidate?.ncm !== undefined || record.candidate?.ean !== undefined) {
    return true;
  }

  return (record.candidateIssues ?? []).some((issue) => issue.field === 'ncm' || issue.field === 'ean');
}

/**
 * Registros dos arquivos que alimentam a base: os que nao sao nota fiscal e
 * trazem algum NCM ou codigo de barras, valido ou nao.
 */
export function selectReferenceRecords(records) {
  const files = new Set();

  for (const record of records) {
    if (record.source?.format !== IMPORT_FORMAT_XML && mentionsReferenceField(record)) {
      files.add(record.source?.fileIndex);
    }
  }

  return records.filter(
    (record) => record.source?.format !== IMPORT_FORMAT_XML && files.has(record.source?.fileIndex),
  );
}

function emptySummary(recordCount) {
  return {
    recordCount,
    entryCount: 0,
    withNcm: 0,
    withEan: 0,
    invalidNcm: 0,
    invalidEan: 0,
    unusable: 0,
    repeated: 0,
  };
}

export function buildReferenceEntries(records) {
  const summary = emptySummary(records.length);
  const seen = new Set();
  const entries = [];

  for (const record of records) {
    const code = readFileValue(record, 'systemCode');
    const key = code.value === undefined ? '' : comparableCode(code.value);

    if (key !== '') {
      if (seen.has(key)) {
        summary.repeated += 1;
        continue;
      }

      seen.add(key);
    }

    const ncm = readFileValue(record, 'ncm');
    const ean = readFileValue(record, 'ean');

    if (ncm.invalid) {
      summary.invalidNcm += 1;
    }

    if (ean.invalid) {
      summary.invalidEan += 1;
    }

    if (key === '' || (ncm.value === undefined && ean.value === undefined)) {
      summary.unusable += 1;
      continue;
    }

    const entry = { comparableCode: key, systemCode: code.value };

    if (ncm.value !== undefined) {
      entry.ncm = ncm.value;
      summary.withNcm += 1;
    }

    if (ean.value !== undefined) {
      entry.ean = ean.value;
      summary.withEan += 1;
    }

    entries.push(entry);
  }

  summary.entryCount = entries.length;

  return { entries, summary };
}

/**
 * Linhas da base depois da atualizacao codigo por codigo, sem gravar. O campo
 * ausente no arquivo mantem o valor guardado. `existing` e o `Map` da chave
 * para a linha guardada.
 */
export function planReferenceMerge(entries, existing) {
  const merged = [];
  const summary = { added: 0, updated: 0, unchanged: 0 };

  for (const entry of entries) {
    const stored = existing.get(entry.comparableCode);

    if (!stored) {
      merged.push({ ...entry });
      summary.added += 1;
      continue;
    }

    const next = { comparableCode: entry.comparableCode, systemCode: entry.systemCode };
    const ncm = entry.ncm ?? stored.ncm;
    const ean = entry.ean ?? stored.ean;

    if (ncm !== undefined) {
      next.ncm = ncm;
    }

    if (ean !== undefined) {
      next.ean = ean;
    }

    if (next.ncm === stored.ncm && next.ean === stored.ean) {
      summary.unchanged += 1;
    } else {
      summary.updated += 1;
    }

    merged.push(next);
  }

  return { entries: merged, summary };
}
