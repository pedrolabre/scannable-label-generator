import { ISSUE_SEVERITY_NOTICE } from './productCandidateIssue.js';

/**
 * Relatorio do lote: o que cada registro tem a dizer antes de virar produto.
 *
 * Tres estados, e so um deles impede a gravacao:
 *
 * - `ready`     passou no contrato e nao tem aviso nenhum;
 * - `attention` passou no contrato, mas o caminho ate aqui deixou alguma
 *               observacao — nome encurtado, campo do arquivo que ficou de
 *               fora, ou uma correcao do proprio usuario. Grava;
 * - `refused`   o contrato recusou. Nao grava.
 *
 * A severidade do aviso **nao** decide o estado. Quem decide e o contrato: um
 * campo omitido pelo mapeamento so vira recusa quando o contrato o exige, e o
 * mesmo aviso num campo opcional fica sendo observacao. Por isso o aviso e a
 * recusa nunca competem pela mesma linha.
 *
 * ## Uma linha por campo, sem dizer a mesma coisa duas vezes
 *
 * | O campo tem | A linha traz |
 * | --- | --- |
 * | recusa do contrato e aviso | a frase do contrato como veredito, a do aviso como causa, e o texto cru |
 * | recusa do contrato, sem aviso | a frase do contrato, sozinha |
 * | aviso, sem recusa | a frase do aviso, sozinha, com o texto cru |
 *
 * A frase do contrato diz o que falta; a do aviso diz por que faltou. Sao
 * respostas a perguntas diferentes, e e por isso que cabem na mesma linha em
 * vez de virarem duas entradas irmas repetindo o mesmo campo.
 *
 * ## Motivos, e nao um estado calculado na tela
 *
 * Cada entrada carrega a lista de motivos que a tiraram de `ready`. A tela
 * mostra tudo o que tem motivo, sem saber quais motivos existem, e o conjunto
 * de motivos que impedem a gravacao esta em `BLOCKING_REASONS`. E assim que a
 * resolucao de codigo repetido cabe nesta mesma lista, mais tarde, sem que a
 * lista precise ser reescrita.
 */

export const RECORD_STATUS_READY = 'ready';
export const RECORD_STATUS_ATTENTION = 'attention';
export const RECORD_STATUS_REFUSED = 'refused';

/** O contrato do produto recusou o registro. */
export const REPORT_REASON_INVALID = 'invalid';
/** Campo preenchido que merece conferencia — hoje so o nome encurtado. */
export const REPORT_REASON_REVIEW = 'review';
/** Campo que o arquivo trazia e o mapeamento deixou de fora, sem recusa. */
export const REPORT_REASON_DROPPED = 'dropped';
/** O usuario corrigiu algum campo do registro na revisao. */
export const REPORT_REASON_CORRECTED = 'corrected';

export const BLOCKING_REASONS = new Set([REPORT_REASON_INVALID]);

/**
 * Ordem de leitura das linhas, a mesma em que os campos aparecem no contrato e
 * no formulario. Campo fora da lista — que o mapeamento de hoje nao produz —
 * entra depois, em vez de sumir.
 */
const FIELD_ORDER = [
  'systemCode',
  'displayName',
  'description',
  'priceInCentavos',
  'ean',
  'category',
  'notes',
];

/**
 * Ultimo recurso: o contrato recusou sem apontar campo. Nao acontece com o
 * mapeamento atual, que so escreve campos do contrato, e existe para que uma
 * recusa jamais apareca na tela como uma linha em branco.
 */
const UNPLACED_REFUSAL = 'O registro não foi aceito pelo contrato do produto.';

function groupIssuesByField(issues) {
  const grouped = new Map();

  for (const issue of issues) {
    const current = grouped.get(issue.field);

    if (current) {
      current.push(issue);
    } else {
      grouped.set(issue.field, [issue]);
    }
  }

  return grouped;
}

function orderedFields(fieldErrors, issuesByField) {
  const extra = [];

  for (const field of [...Object.keys(fieldErrors), ...issuesByField.keys()]) {
    if (!FIELD_ORDER.includes(field) && !extra.includes(field)) {
      extra.push(field);
    }
  }

  return [...FIELD_ORDER, ...extra];
}

function reasonForSeverity(severity) {
  return severity === ISSUE_SEVERITY_NOTICE ? REPORT_REASON_REVIEW : REPORT_REASON_DROPPED;
}

/**
 * Entrada do relatorio para um registro.
 *
 * `index` e a posicao do registro no lote. Ele e o endereco de volta: a tela
 * alcanca o registro por ele sem varrer a lista, e a ordem da revisao continua
 * sendo a ordem dos arquivos escolhidos.
 *
 * O campo corrigido pelo usuario perde os avisos do mapeamento: eles descrevem
 * o valor que veio do arquivo, e esse valor deixou de ser o que sera gravado. A
 * recusa do contrato, essa continua — ela fala do valor corrigido, porque a
 * conferencia ja rodou sobre ele.
 */
export function describeRecord(record, validation, index, correction = null) {
  const { fieldErrors } = validation;
  const issuesByField = groupIssuesByField(record.candidateIssues ?? []);
  const corrected = Boolean(correction && Object.keys(correction).length > 0);
  const lines = [];
  const reasons = [];

  function addReason(reason) {
    if (!reasons.includes(reason)) {
      reasons.push(reason);
    }
  }

  for (const field of orderedFields(fieldErrors, issuesByField)) {
    const error = fieldErrors[field];
    const issues = corrected && field in correction ? [] : (issuesByField.get(field) ?? []);

    if (error) {
      lines.push({
        field,
        blocking: true,
        message: error,
        cause: issues.length > 0 ? issues.map((issue) => issue.message).join(' ') : null,
        rawValue: issues.length > 0 ? issues[0].rawValue : null,
      });

      addReason(REPORT_REASON_INVALID);
      continue;
    }

    for (const issue of issues) {
      lines.push({
        field,
        blocking: false,
        message: issue.message,
        cause: null,
        rawValue: issue.rawValue,
      });

      addReason(reasonForSeverity(issue.severity));
    }
  }

  if (!validation.success && !reasons.includes(REPORT_REASON_INVALID)) {
    lines.push({ field: null, blocking: true, message: UNPLACED_REFUSAL, cause: null, rawValue: null });
    addReason(REPORT_REASON_INVALID);
  }

  if (corrected) {
    addReason(REPORT_REASON_CORRECTED);
  }

  return {
    recordId: record.recordId,
    index,
    status: recordStatus(reasons),
    reasons,
    corrected,
    lines,
  };
}

function recordStatus(reasons) {
  if (reasons.includes(REPORT_REASON_INVALID)) {
    return RECORD_STATUS_REFUSED;
  }

  return reasons.length > 0 ? RECORD_STATUS_ATTENTION : RECORD_STATUS_READY;
}

export function blocksWriting(entry) {
  return entry.reasons.some((reason) => BLOCKING_REASONS.has(reason));
}

export function createImportReport() {
  return {
    entries: new Map(),
    reviewIds: [],
    readyCount: 0,
    attentionCount: 0,
    refusedCount: 0,
  };
}

function countKeyFor(status) {
  if (status === RECORD_STATUS_REFUSED) {
    return 'refusedCount';
  }

  return status === RECORD_STATUS_ATTENTION ? 'attentionCount' : 'readyCount';
}

/**
 * Acrescenta a entrada ao relatorio em construcao. Altera o objeto recebido de
 * proposito: e a montagem do lote inteiro, antes de qualquer leitura, e copiar
 * o relatorio a cada registro custaria uma copia por registro.
 */
export function pushRecordReport(report, entry) {
  report.entries.set(entry.recordId, entry);
  report[countKeyFor(entry.status)] += 1;

  if (entry.status !== RECORD_STATUS_READY) {
    report.reviewIds.push(entry.recordId);
  }

  return report;
}

function insertReviewId(report, entry) {
  const next = [...report.reviewIds];
  const position = next.findIndex((id) => (report.entries.get(id)?.index ?? -1) > entry.index);

  if (position === -1) {
    next.push(entry.recordId);
  } else {
    next.splice(position, 0, entry.recordId);
  }

  return next;
}

/**
 * Relatorio com uma entrada trocada, depois de uma correcao do usuario.
 *
 * O mapa de entradas e alterado no lugar e o relatorio volta como objeto novo:
 * copiar centenas de milhares de entradas a cada tecla digitada travaria a
 * edicao, e quem le sempre chega pelo relatorio devolvido aqui.
 *
 * A lista de revisao mantem a ordem do lote, inclusive quando um registro entra
 * nela agora — o que acontece quando a correcao passa a ser recusada pelo
 * contrato, e e justamente a hora em que a linha precisa continuar a vista.
 */
export function replaceRecordReport(report, entry) {
  const previous = report.entries.get(entry.recordId);

  report.entries.set(entry.recordId, entry);

  const next = { ...report, entries: report.entries };

  if (previous) {
    next[countKeyFor(previous.status)] -= 1;
  }

  next[countKeyFor(entry.status)] += 1;

  const wasInReview = Boolean(previous) && previous.status !== RECORD_STATUS_READY;
  const isInReview = entry.status !== RECORD_STATUS_READY;

  if (wasInReview && !isInReview) {
    next.reviewIds = report.reviewIds.filter((id) => id !== entry.recordId);
  } else if (!wasInReview && isInReview) {
    next.reviewIds = insertReviewId(report, entry);
  }

  return next;
}

export function getRecordReport(report, recordId) {
  return report.entries.get(recordId) ?? null;
}

/**
 * Registros que a revisao mostra: os que tem motivo, na ordem do lote, ate o
 * limite pedido. O limite existe porque um lote inteiro pode ser recusado de
 * uma vez — uma planilha com os nomes de coluna errados recusa tudo — e ai a
 * lista de motivos tem o tamanho do lote.
 */
export function takeReviewEntries(report, limit) {
  const ids = report.reviewIds.slice(0, limit);

  return ids.map((id) => report.entries.get(id)).filter(Boolean);
}

/**
 * Quantos registros seguiriam para o catalogo: os prontos e os que so pedem
 * conferencia. Recusa do contrato fica de fora.
 */
export function writableCount(report) {
  return report.readyCount + report.attentionCount;
}
