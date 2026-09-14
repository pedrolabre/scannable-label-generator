import { normalizeSearchText } from './productSearch.js';

/**
 * Codigo repetido no lote importado, e o vocabulario da decisao do usuario.
 *
 * A deteccao e um passo proprio, depois da conferencia do contrato, e nao um
 * trecho dentro dela. O motivo e a ordem em que a informacao aparece: numa
 * passagem unica, o segundo registro de um codigo repetido so e conhecido
 * depois que o primeiro ja foi publicado como pronto, e a entrada dele teria de
 * ser reescrita para tras, com as contagens e a ordem da revisao junto. Agrupar
 * o lote inteiro antes de tocar em qualquer entrada elimina esse retrabalho.
 *
 * Na gravacao seria tarde: codigo repetido se resolve por decisao explicita do
 * usuario, e a decisao precisa existir antes da escrita.
 *
 * ## Duas perguntas, dois motivos
 *
 * Um codigo pode se repetir dentro do proprio lote — o mesmo produto vendido em
 * dois dias, vindo de duas notas — ou pode ja existir no catalogo. Sao conflitos
 * diferentes porque os verbos oferecidos sao diferentes: nao ha produto gravado
 * para substituir no primeiro caso.
 *
 * O terceiro caso nao e conflito: o codigo existe no catalogo e todos os campos
 * do arquivo sao iguais aos do produto gravado. Nao ha o que decidir, e
 * perguntar seria ruido — o registro e pulado sozinho e contado a parte.
 *
 * ## A colisao de nome anda junto, mas nao bloqueia
 *
 * O nome encurtado tambem pode se repetir, e a leitura de referencia das notas
 * reais mostrou que se repete. Ela e aviso, e nao pergunta: `displayName` nao
 * identifica produto, dois produtos podem legitimamente levar o mesmo nome na
 * etiqueta, e o que resolve a duvida — o texto completo do produto — ja esta na
 * linha desde o bloco anterior.
 *
 * O indice em que estas perguntas sao respondidas, e as passagens que o montam,
 * ficam em `importConflictIndex.js`. Aqui e o vocabulario e a leitura de **um**
 * registro.
 */

/** Dois ou mais registros do proprio lote carregam o mesmo codigo. */
export const CONFLICT_KIND_BATCH = 'batch';
/** O codigo do registro ja existe no catalogo, com conteudo diferente. */
export const CONFLICT_KIND_CATALOG = 'catalog';
/** O codigo ja existe no catalogo e o conteudo e o mesmo. Nada a decidir. */
export const CONFLICT_KIND_IDENTICAL = 'identical';

/** Regrava o produto do catalogo com o que veio do arquivo. */
export const DECISION_REPLACE = 'replace';
/** Mantem o catalogo como esta e nao grava este registro. */
export const DECISION_SKIP = 'skip';
/** Grava como produto separado, com identificador proprio. */
export const DECISION_KEEP_BOTH = 'keepBoth';

/**
 * Campos comparados para decidir se o registro e o produto gravado dizem a
 * mesma coisa. Identificador e datas ficam de fora: eles nunca vem do arquivo.
 */
const COMPARED_FIELDS = [
  'systemCode',
  'displayName',
  'description',
  'priceInCentavos',
  'ean',
  'category',
  'notes',
];

// Texto vazio e campo ausente sao a mesma coisa na comparacao: o contrato apara
// antes de gravar e remove o opcional que ficou em branco, entao o produto do
// banco nunca guarda um dos dois.
function comparableValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    return trimmed === '' ? null : trimmed;
  }

  return value;
}

function saysTheSame(product, candidate) {
  return COMPARED_FIELDS.every(
    (field) => comparableValue(product[field]) === comparableValue(candidate[field]),
  );
}

/** Chave de comparacao do nome da etiqueta: sem acento, em caixa baixa. */
export function nameKeyFor(candidate) {
  return normalizeSearchText(candidate.displayName);
}

function codeConflictFor(index, candidate, recordIndex) {
  const code = candidate.systemCode ?? '';

  if (code === '') {
    return null;
  }

  const stored = index.catalog.byCode.get(code) ?? null;
  const group = index.codeGroups.get(code) ?? null;
  const batchCount = group ? group.length : 1;

  if (stored && stored.length > 0) {
    const identical = stored.find((product) => saysTheSame(product, candidate)) ?? null;

    return {
      kind: identical ? CONFLICT_KIND_IDENTICAL : CONFLICT_KIND_CATALOG,
      storedProduct: identical ?? stored[0],
      storedCount: stored.length,
      batchCount,
    };
  }

  if (batchCount > 1 && group.includes(recordIndex)) {
    return { kind: CONFLICT_KIND_BATCH, storedProduct: null, storedCount: 0, batchCount };
  }

  return null;
}

function nameConflictFor(index, candidate, recordIndex) {
  const key = nameKeyFor(candidate);

  if (key === '') {
    return null;
  }

  const group = index.nameGroups.get(key) ?? null;
  const inBatch = Boolean(group) && group.length > 1 && group.includes(recordIndex);
  const inCatalog = index.catalog.nameKeys.has(key);

  if (!inBatch && !inCatalog) {
    return null;
  }

  return { inBatch, inCatalog, batchCount: group ? group.length : 1 };
}

/**
 * O que este registro tem de conflito, ou `null` quando nao tem nenhum.
 *
 * Quando o produto gravado e igual ao do arquivo, a colisao de nome nao e
 * relatada: ela seria o proprio produto colidindo com ele mesmo.
 */
export function conflictFor(index, record, candidate, recordIndex) {
  const code = codeConflictFor(index, candidate, recordIndex);
  const name =
    code?.kind === CONFLICT_KIND_IDENTICAL ? null : nameConflictFor(index, candidate, recordIndex);

  if (!code && !name) {
    return null;
  }

  return { recordId: record.recordId, code, name, decision: null };
}

export function withDecision(conflict, decision) {
  return { ...conflict, decision: decision ?? null };
}

/** Verbos que fazem sentido para este conflito, na ordem em que sao oferecidos. */
export function availableDecisions(conflict) {
  const kind = conflict?.code?.kind ?? null;

  if (kind === CONFLICT_KIND_CATALOG) {
    return [DECISION_REPLACE, DECISION_SKIP, DECISION_KEEP_BOTH];
  }

  if (kind === CONFLICT_KIND_BATCH) {
    return [DECISION_SKIP, DECISION_KEEP_BOTH];
  }

  return [];
}

/** Conflito que ainda espera o usuario, e por isso impede a gravacao. */
export function isConflictPending(conflict) {
  return availableDecisions(conflict).length > 0 && !conflict.decision;
}

/**
 * Retrato dos conflitos do lote, para as frases da tela e para a acao em massa.
 *
 * Roda sobre o mapa de conflitos, que guarda so os registros que tem conflito —
 * nao sobre o lote. Quem chama guarda o resultado no estado em vez de recalcular
 * a cada desenho da tela.
 */
export function summarizeConflicts(conflicts) {
  const summary = {
    total: 0,
    pending: 0,
    pendingInBatch: 0,
    pendingInCatalog: 0,
    identical: 0,
    toSkip: 0,
    toReplace: 0,
    named: 0,
  };

  for (const conflict of conflicts.values()) {
    summary.total += 1;

    if (conflict.name) {
      summary.named += 1;
    }

    const kind = conflict.code?.kind ?? null;

    if (kind === CONFLICT_KIND_IDENTICAL) {
      summary.identical += 1;
    } else if (isConflictPending(conflict)) {
      summary.pending += 1;

      if (kind === CONFLICT_KIND_BATCH) {
        summary.pendingInBatch += 1;
      } else {
        summary.pendingInCatalog += 1;
      }
    } else if (conflict.decision === DECISION_SKIP) {
      summary.toSkip += 1;
    } else if (conflict.decision === DECISION_REPLACE) {
      summary.toReplace += 1;
    }
  }

  return summary;
}

