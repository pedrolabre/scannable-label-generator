import {
  RECORD_STATUS_ATTENTION,
  RECORD_STATUS_PENDING,
  RECORD_STATUS_READY,
  RECORD_STATUS_REFUSED,
} from './importReport.js';

/**
 * O relatorio como colecao: as entradas do lote, as contagens por estado e a
 * lista do que a revisao mostra.
 *
 * Vive separado da descricao de um registro porque responde a outra pergunta.
 * `importReport.js` diz o que **um** registro tem a dizer; aqui ficam as
 * operacoes sobre o conjunto, que existem quase todas por causa do tamanho do
 * lote: nada percorre as entradas quando um unico registro muda, e nada copia o
 * mapa de entradas.
 *
 * O relatorio e `{ entries, reviewIds, readyCount, attentionCount, pendingCount,
 * refusedCount }`. `entries` e um `Map` na ordem do lote — e essa ordem que faz a
 * lista de revisao sair ordenada de graca quando precisa ser reconstruida.
 */

const COUNT_KEY_BY_STATUS = new Map([
  [RECORD_STATUS_REFUSED, 'refusedCount'],
  [RECORD_STATUS_PENDING, 'pendingCount'],
  [RECORD_STATUS_ATTENTION, 'attentionCount'],
  [RECORD_STATUS_READY, 'readyCount'],
]);

function countKeyFor(status) {
  return COUNT_KEY_BY_STATUS.get(status) ?? 'readyCount';
}

export function createImportReport() {
  return {
    entries: new Map(),
    reviewIds: [],
    readyCount: 0,
    attentionCount: 0,
    pendingCount: 0,
    refusedCount: 0,
  };
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

/**
 * Contagens e lista de revisao recalculadas a partir das entradas.
 *
 * Serve para o caso em que muitas entradas trocam de uma vez — a deteccao de
 * codigo repetido sobre o lote inteiro, ou uma decisao aplicada a todos os
 * conflitos. Trocar uma por uma custaria uma varredura da lista de revisao por
 * entrada trocada; aqui e uma passagem so.
 *
 * A ordem sai de graca: o mapa de entradas guarda a ordem do lote, e a lista de
 * revisao herda essa ordem ao ser reconstruida.
 */
export function rebuildReportIndex(report) {
  const next = {
    ...report,
    entries: report.entries,
    reviewIds: [],
    readyCount: 0,
    attentionCount: 0,
    pendingCount: 0,
    refusedCount: 0,
  };

  for (const entry of report.entries.values()) {
    next[countKeyFor(entry.status)] += 1;

    if (entry.status !== RECORD_STATUS_READY) {
      next.reviewIds.push(entry.recordId);
    }
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
 * Quantos registros o relatorio nao impede de gravar: os prontos e os que so
 * pedem conferencia. Recusa do contrato e conflito sem decisao ficam de fora.
 *
 * Dois casos sao subtraidos por quem monta a frase, e nao aqui: o registro que
 * ja esta no catalogo igual ao do arquivo, e o que o usuario decidiu pular. Os
 * dois sao `attention` porque tem algo a dizer, e quem sabe quantos sao e o mapa
 * de conflitos, que e pequeno — varrer o lote inteiro para descobrir isso seria
 * uma passagem por registro a cada clique.
 */
export function writableCount(report) {
  return report.readyCount + report.attentionCount;
}
