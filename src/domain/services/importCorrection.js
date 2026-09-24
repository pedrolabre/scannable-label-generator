/**
 * Correcao do usuario sobre um registro do lote.
 *
 * A correcao mora em um mapa proprio, indexado por `recordId`, e nunca dentro
 * do registro. O motivo e que `raw` e `candidate` respondem a uma pergunta
 * diferente da correcao: eles dizem o que o arquivo trazia. Se a correcao
 * sobrescrevesse `candidate`, o texto original desapareceria junto e o aviso
 * que pediu a conferencia — que guarda o valor cru ao lado — passaria a
 * apontar para um valor que nao existe mais.
 *
 * Com o mapa separado, o original continua inteiro e visivel, desfazer e
 * remover uma chave, e fica evidente quais registros o usuario tocou.
 *
 * `resolveCandidate` e o unico lugar que junta os dois, e e por ele que a
 * conferencia e a gravacao passam — nenhum dos dois refaz a mistura.
 */

/**
 * Campos que a revisao do lote deixa editar. O nome da etiqueta e o campo que
 * chega ja preenchido, e o unico que a revisao precisa corrigir para que o lote
 * possa seguir.
 */
export const CORRECTABLE_FIELDS = ['displayName'];

export function correctionFor(corrections, recordId) {
  return corrections[recordId] ?? null;
}

/**
 * Campos do produto do registro com a correcao aplicada por cima. Sem correcao,
 * devolve o proprio `candidate`, sem copia.
 */
export function resolveCandidate(record, correction) {
  return correction ? { ...record.candidate, ...correction } : record.candidate;
}

/**
 * Campos do produto de um registro, com a correcao que houver, buscada pelo
 * mapa. Atalho para os dois passos que sempre andam juntos — a deteccao de
 * conflito e a gravacao em lote chegam ao candidato por aqui, e nenhum dos dois
 * refaz a mistura.
 */
export function candidateForRecord(record, corrections) {
  return resolveCandidate(record, correctionFor(corrections, record.recordId));
}

/**
 * Mapa de correcoes com um campo alterado.
 *
 * Valor igual ao original deixa de ser correcao e some do mapa — inclusive
 * quando foi o usuario que digitou o texto de volta. E um registro sem nenhum
 * campo corrigido some do mapa inteiro, para que "tem correcao" continue sendo
 * so a presenca da chave.
 *
 * O texto entra como foi digitado, sem aparar: o contrato ja apara antes de
 * medir, e aparar aqui apagaria o espaco no meio de uma palavra sendo escrita.
 */
export function applyCorrection(corrections, record, field, value) {
  const { recordId } = record;
  const original = record.candidate[field] ?? '';
  const next = { ...corrections };
  const current = { ...(next[recordId] ?? {}) };

  if (value === original) {
    delete current[field];
  } else {
    current[field] = value;
  }

  if (Object.keys(current).length === 0) {
    delete next[recordId];
  } else {
    next[recordId] = current;
  }

  return next;
}

/**
 * Mapa de correcoes sem nenhuma alteracao do registro, que e o que devolve o
 * valor original para a tela e para a conferencia.
 */
export function clearCorrection(corrections, recordId) {
  if (!corrections[recordId]) {
    return corrections;
  }

  const next = { ...corrections };

  delete next[recordId];

  return next;
}
