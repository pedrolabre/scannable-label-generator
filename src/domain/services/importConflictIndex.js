import { candidateForRecord } from './importCorrection.js';

import { conflictFor, nameKeyFor } from './importConflict.js';

/**
 * Indice do conflito: o catalogo gravado e o lote agrupados de modo que a
 * pergunta "este codigo se repete?" seja respondida sem varrer nada de novo.
 *
 * ## O catalogo entra inteiro na memoria
 *
 * `listProducts` e o caminho de leitura unico da tabela, e a listagem de
 * produtos ja materializa todos os produtos: indexar esse mesmo array por codigo
 * nao acrescenta uma classe de custo nova. A alternativa — consultar o indice do
 * banco por registro — custaria uma ida ao IndexedDB por registro do lote.
 *
 * ## O lote e agrupado, e depois podado
 *
 * O agrupamento precisa passar por todos os codigos e todos os nomes, mas o
 * indice que sobrevive guarda **so os grupos com mais de um membro**. Sem a poda,
 * um lote de 200 mil codigos distintos manteria 200 mil chaves vivas para nao
 * responder nada.
 *
 * A poda tem uma consequencia assumida do lado dos nomes: um nome que era unico
 * no lote e passou a coincidir com outro por edicao manual nao forma grupo novo.
 * O lado do catalogo continua completo e e reconsultado a cada recalculo, entao a
 * colisao contra um produto ja gravado aparece mesmo depois de uma edicao.
 *
 * ## Fatias, como no resto do importador
 *
 * A primeira passagem percorre o lote em fatias, com cessao de turno entre elas.
 * A segunda visita so os registros que ficaram em algum grupo vivo: num lote de
 * 200 mil registros com tres conflitos, ela visita tres.
 */

export const CONFLICT_SLICE_SIZE = 2000;

function yieldToInterface() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function pushInto(groups, key, index) {
  const current = groups.get(key);

  if (current) {
    current.push(index);
  } else {
    groups.set(key, [index]);
  }
}

/**
 * Catalogo gravado em forma consultavel: produtos por codigo e o conjunto dos
 * nomes ja usados. O codigo e indice nao unico no banco, entao a chave guarda
 * uma lista — um catalogo pode ja ter mais de um produto com o mesmo codigo.
 */
export function indexCatalog(products) {
  const byCode = new Map();
  const nameKeys = new Set();

  for (const product of products) {
    pushIntoCatalog(byCode, product);
    nameKeys.add(nameKeyFor(product));
  }

  return { byCode, nameKeys };
}

function pushIntoCatalog(byCode, product) {
  const current = byCode.get(product.systemCode);

  if (current) {
    current.push(product);
  } else {
    byCode.set(product.systemCode, [product]);
  }
}

/** Agrupa o lote, poda o que nao responde nada, e entrega cada conflito encontrado. */
export async function detectImportConflicts(records, options = {}) {
  const {
    catalog = { byCode: new Map(), nameKeys: new Set() },
    corrections = {},
    sliceSize = CONFLICT_SLICE_SIZE,
    onConflict,
    onProgress,
  } = options;

  const codeGroups = new Map();
  const nameGroups = new Map();
  const total = records.length;

  for (let start = 0; start < total; start += sliceSize) {
    const end = Math.min(start + sliceSize, total);

    for (let position = start; position < end; position += 1) {
      const candidate = candidateForRecord(records[position], corrections);
      const code = candidate.systemCode ?? '';
      const nameKey = nameKeyFor(candidate);

      if (code !== '') {
        pushInto(codeGroups, code, position);
      }

      if (nameKey !== '') {
        pushInto(nameGroups, nameKey, position);
      }
    }

    onProgress?.(end, total);

    if (end < total) {
      await yieldToInterface();
    }
  }

  const index = {
    catalog,
    codeGroups: pruneGroups(codeGroups, (key) => catalog.byCode.has(key)),
    nameGroups: pruneGroups(nameGroups, (key) => catalog.nameKeys.has(key)),
  };

  await reportConflicts(index, records, corrections, sliceSize, onConflict);

  return index;
}

/**
 * Grupo de um membro so que nao encontra par no catalogo nao responde nada, e
 * manter a chave viva custaria uma entrada por registro do lote.
 */
function pruneGroups(groups, isInCatalog) {
  const kept = new Map();

  for (const [key, positions] of groups) {
    if (positions.length > 1 || isInCatalog(key)) {
      kept.set(key, positions);
    }
  }

  return kept;
}

async function reportConflicts(index, records, corrections, sliceSize, onConflict) {
  const affected = new Set();

  for (const positions of index.codeGroups.values()) {
    for (const position of positions) {
      affected.add(position);
    }
  }

  for (const positions of index.nameGroups.values()) {
    for (const position of positions) {
      affected.add(position);
    }
  }

  const positions = [...affected].sort((first, second) => first - second);
  let sinceYield = 0;

  for (const position of positions) {
    const record = records[position];
    const conflict = conflictFor(index, record, candidateForRecord(record, corrections), position);

    if (conflict) {
      onConflict?.(record, conflict, position);
    }

    sinceYield += 1;

    if (sinceYield >= sliceSize) {
      sinceYield = 0;
      await yieldToInterface();
    }
  }
}

/**
 * Move um registro de grupo de nome depois de o usuario corrigir o nome, e
 * devolve as posicoes cujo conflito pode ter mudado.
 *
 * So os dois grupos envolvidos sao mexidos. Varrer o lote inteiro a cada tecla
 * digitada e o que esta escolha evita — e a razao de o indice sobreviver no
 * estado em vez de ser recalculado.
 *
 * O grupo podado na deteccao nao volta: um nome que era unico no lote e passou a
 * coincidir com outro por edicao manual nao forma grupo novo. O grupo que existia
 * continua no indice mesmo com um membro so, porque desfazer a correcao devolve o
 * registro a ele. O lado do catalogo, esse, e completo, e continua sendo
 * consultado a cada recalculo.
 */
export function updateNameGroups(index, recordIndex, previousKey, nextKey) {
  const affected = new Set([recordIndex]);

  if (previousKey === nextKey) {
    return [...affected];
  }

  const previous = previousKey ? index.nameGroups.get(previousKey) : null;

  if (previous) {
    for (const position of previous) {
      affected.add(position);
    }

    const remaining = previous.filter((position) => position !== recordIndex);

    // O grupo que ficou com um membro so continua no indice, e nao e descartado:
    // desfazer a correcao devolve o registro a ele, e a colisao precisa voltar.
    // Um grupo de um membro nao produz conflito, entao mante-lo nao inventa aviso
    // nenhum. So o grupo vazio sai.
    if (remaining.length > 0) {
      index.nameGroups.set(previousKey, remaining);
    } else {
      index.nameGroups.delete(previousKey);
    }
  }

  const next = nextKey ? index.nameGroups.get(nextKey) : null;

  if (next) {
    next.push(recordIndex);

    for (const position of next) {
      affected.add(position);
    }
  }

  return [...affected].sort((first, second) => first - second);
}
