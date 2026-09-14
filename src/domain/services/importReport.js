import {
  CONFLICT_KIND_BATCH,
  CONFLICT_KIND_CATALOG,
  CONFLICT_KIND_IDENTICAL,
  isConflictPending,
} from './importConflict.js';
import { ISSUE_SEVERITY_NOTICE } from './productCandidateIssue.js';

/**
 * Relatorio do lote: o que cada registro tem a dizer antes de virar produto.
 *
 * Quatro estados, e dois deles impedem a gravacao:
 *
 * - `ready`     passou no contrato e nao tem aviso nenhum;
 * - `attention` passou no contrato, mas o caminho ate aqui deixou alguma
 *               observacao — nome encurtado, campo do arquivo que ficou de
 *               fora, ou uma correcao do proprio usuario. Grava;
 * - `pending`   tem codigo repetido e espera a decisao do usuario. Nao grava
 *               ainda, e passa a gravar no instante em que a decisao existe;
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
 * resolucao de codigo repetido cabe nesta mesma lista sem que a lista precise
 * ser reescrita: o codigo repetido acrescenta motivo, e o registro pronto que
 * colide sobe para a lista de revisao na mesma linha em que ja estaria.
 *
 * ## O conflito entra como motivo, e nao como linha de campo
 *
 * Codigo repetido nao e campo recusado: e uma pergunta cuja resposta e um
 * verbo — substituir, pular, gravar como novo. Por isso a entrada carrega o
 * conflito inteiro em `conflict`, e a tela monta o controle a partir dele, em
 * vez de receber uma frase pronta entre as linhas de campo.
 *
 * Enquanto a resposta nao existe, o motivo `conflictPending` esta na lista e
 * impede a gravacao daquele registro — so daquele. Tomada a decisao, o motivo
 * do conflito continua (ele descreve algo que e verdade), e apenas o
 * `conflictPending` deixa de ser produzido, de modo que `blocksWriting(entry)`
 * segue sendo a unica pergunta antes de gravar.
 *
 * O relatorio como colecao — as entradas do lote, as contagens e a lista da
 * revisao — fica em `importReportIndex.js`. Aqui e o que **um** registro diz.
 */

export const RECORD_STATUS_READY = 'ready';
export const RECORD_STATUS_ATTENTION = 'attention';
/** Depende de uma decisao do usuario para poder seguir. Nao grava ainda. */
export const RECORD_STATUS_PENDING = 'pending';
export const RECORD_STATUS_REFUSED = 'refused';

/** O contrato do produto recusou o registro. */
export const REPORT_REASON_INVALID = 'invalid';
/** Campo preenchido que merece conferencia — hoje so o nome encurtado. */
export const REPORT_REASON_REVIEW = 'review';
/** Campo que o arquivo trazia e o mapeamento deixou de fora, sem recusa. */
export const REPORT_REASON_DROPPED = 'dropped';
/** O usuario corrigiu algum campo do registro na revisao. */
export const REPORT_REASON_CORRECTED = 'corrected';
/** Outro registro do mesmo lote carrega este codigo. */
export const REPORT_REASON_DUPLICATE_IN_BATCH = 'duplicateInBatch';
/** O codigo do registro ja existe no catalogo, com conteudo diferente. */
export const REPORT_REASON_DUPLICATE_IN_CATALOG = 'duplicateInCatalog';
/** O codigo ja existe no catalogo e o conteudo e o mesmo. Nada a decidir. */
export const REPORT_REASON_DUPLICATE_IDENTICAL = 'duplicateIdentical';
/** Outro registro do lote, ou um produto gravado, leva este mesmo nome. */
export const REPORT_REASON_DUPLICATE_NAME = 'duplicateName';
/** Ha conflito de codigo e o usuario ainda nao disse o que fazer. */
export const REPORT_REASON_CONFLICT_PENDING = 'conflictPending';

/**
 * O que impede a gravacao. A recusa do contrato e o veredito do produto; o
 * conflito pendente e a ausencia de uma decisao que so o usuario pode tomar, e
 * ele sai deste conjunto no instante em que a decisao existe — nao pela remocao
 * do motivo do conflito, que continua sendo verdade, mas porque o proprio
 * `conflictPending` deixa de ser produzido.
 */
export const BLOCKING_REASONS = new Set([REPORT_REASON_INVALID, REPORT_REASON_CONFLICT_PENDING]);

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

const REASON_BY_CONFLICT_KIND = new Map([
  [CONFLICT_KIND_BATCH, REPORT_REASON_DUPLICATE_IN_BATCH],
  [CONFLICT_KIND_CATALOG, REPORT_REASON_DUPLICATE_IN_CATALOG],
  [CONFLICT_KIND_IDENTICAL, REPORT_REASON_DUPLICATE_IDENTICAL],
]);

/**
 * Motivos que o conflito acrescenta. O conflito nao produz linha de campo: ele
 * nao e um campo recusado, e sim uma pergunta com resposta em botao. A entrada
 * carrega o conflito inteiro, e a tela monta o controle a partir dele.
 */
function conflictReasons(conflict) {
  if (!conflict) {
    return [];
  }

  const reasons = [];
  const kindReason = REASON_BY_CONFLICT_KIND.get(conflict.code?.kind);

  if (kindReason) {
    reasons.push(kindReason);
  }

  if (conflict.name) {
    reasons.push(REPORT_REASON_DUPLICATE_NAME);
  }

  if (isConflictPending(conflict)) {
    reasons.push(REPORT_REASON_CONFLICT_PENDING);
  }

  return reasons;
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
export function describeRecord(record, validation, index, correction = null, conflict = null) {
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

  for (const reason of conflictReasons(conflict)) {
    addReason(reason);
  }

  return {
    recordId: record.recordId,
    index,
    status: recordStatus(reasons),
    reasons,
    corrected,
    lines,
    conflict,
  };
}

/**
 * O estado do registro sai dos motivos, e a ordem das perguntas e a ordem da
 * gravidade: a recusa do contrato nao se resolve nesta tela, a decisao de
 * conflito se resolve, e o aviso nao precisa de acao nenhuma.
 *
 * `pending` existe como estado proprio, e nao como um `attention` qualquer,
 * porque as contagens do relatorio respondem "quantos registros seguiriam para o
 * catalogo": um conflito sem decisao nao segue, e chamar isso de `attention`
 * faria a conta mentir.
 */
function recordStatus(reasons) {
  if (reasons.includes(REPORT_REASON_INVALID)) {
    return RECORD_STATUS_REFUSED;
  }

  if (reasons.includes(REPORT_REASON_CONFLICT_PENDING)) {
    return RECORD_STATUS_PENDING;
  }

  return reasons.length > 0 ? RECORD_STATUS_ATTENTION : RECORD_STATUS_READY;
}

export function blocksWriting(entry) {
  return entry.reasons.some((reason) => BLOCKING_REASONS.has(reason));
}
