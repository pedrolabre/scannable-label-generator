import {
  conflictFor,
  nameKeyFor,
  summarizeConflicts,
  withDecision,
} from '../domain/services/importConflict.js';
import {
  detectImportConflicts,
  indexCatalog,
  updateNameGroups,
} from '../domain/services/importConflictIndex.js';
import {
  candidateForRecord,
  correctionFor,
  resolveCandidate,
} from '../domain/services/importCorrection.js';
import { describeRecord } from '../domain/services/importReport.js';
import {
  rebuildReportIndex,
  replaceRecordReport,
} from '../domain/services/importReportIndex.js';
import { validateCandidate } from '../domain/services/importValidation.js';
import { describeStorageReadError } from '../storage/storageError.js';

import { useProductStore } from './useProductStore.js';

/**
 * As sequencias que atualizam o estado do lote.
 *
 * Elas vivem fora do store porque nao sao acoes que a tela chama: sao os passos
 * que uma acao encadeia — montar a entrada de um registro, ler o catalogo e
 * procurar codigo repetido, reconferir um registro corrigido junto dos vizinhos
 * que a correcao afetou. Cada uma recebe o `set` e o `get` do store, entao o
 * estado continua tendo um dono so.
 */

const EMPTY_CATALOG = { byCode: new Map(), nameKeys: new Set() };

/**
 * Entrada do relatorio para um registro, sempre pelos mesmos tres passos: a
 * correcao que houver, a conferencia sobre o candidato ja corrigido, e o conflito
 * conhecido. Montar a entrada em um lugar so e o que mantem motivos, estado e
 * contagens coerentes entre si.
 */
export function entryFor(record, index, corrections, conflict) {
  const correction = correctionFor(corrections, record.recordId);
  const validation = validateCandidate(resolveCandidate(record, correction));

  return describeRecord(record, validation, index, correction, conflict ?? null);
}

/**
 * Le o catalogo, agrupa o lote e leva os conflitos encontrados para o relatorio.
 *
 * Quando a leitura do catalogo falha, a deteccao segue valendo para o proprio
 * lote, mas `catalogError` fica preenchido e a gravacao nao e oferecida: gravar
 * sem saber o que ja existe no catalogo e exatamente o que esta deteccao evita.
 */
export async function detectConflicts(set, get, records, report) {
  let catalog = EMPTY_CATALOG;

  try {
    catalog = indexCatalog(await useProductStore.getState().loadProducts());
  } catch (error) {
    set({ catalogError: describeStorageReadError(error) });
  }

  const conflicts = new Map();
  const { corrections } = get();

  const conflictIndex = await detectImportConflicts(records, {
    catalog,
    corrections,
    onConflict: (record, conflict) => {
      conflicts.set(record.recordId, conflict);
    },
    onProgress: (checked) => {
      set({ detectedCount: checked });
    },
  });

  for (const [recordId, conflict] of conflicts) {
    const entry = report.entries.get(recordId);

    if (entry) {
      report.entries.set(recordId, entryFor(records[entry.index], entry.index, corrections, conflict));
    }
  }

  set({
    conflictIndex,
    conflicts,
    conflictSummary: summarizeConflicts(conflicts),
    isDetecting: false,
    report: conflicts.size > 0 ? rebuildReportIndex(report) : report,
  });
}

/**
 * Reconfere um registro corrigido e reavalia a colisao de nome dos grupos que a
 * correcao mexeu.
 *
 * So os grupos envolvidos sao revisitados. O codigo do sistema nao e editavel na
 * revisao justamente para que esta reavaliacao nao tenha de refazer tambem os
 * grupos de codigo a cada tecla digitada.
 */
export function refreshRecord(set, get, record, index, previousNameKey) {
  const { records, corrections, report, conflictIndex, conflicts, conflictDecisions } = get();
  const nextKey = nameKeyFor(candidateForRecord(record, corrections));

  const positions = conflictIndex
    ? updateNameGroups(conflictIndex, index, previousNameKey, nextKey)
    : [index];

  let nextReport = report;

  for (const position of positions) {
    const affected = records[position];
    const conflict = conflictIndex
      ? conflictFor(
          conflictIndex,
          affected,
          candidateForRecord(affected, corrections),
          position,
        )
      : null;

    if (conflict) {
      conflicts.set(affected.recordId, withDecision(conflict, conflictDecisions[affected.recordId]));
    } else {
      conflicts.delete(affected.recordId);
    }

    nextReport = replaceRecordReport(
      nextReport,
      entryFor(affected, position, corrections, conflicts.get(affected.recordId)),
    );
  }

  set({
    conflicts,
    conflictSummary: summarizeConflicts(conflicts),
    report: nextReport,
  });
}
