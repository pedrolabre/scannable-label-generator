import { ReferenceEntrySchema } from '../domain/schemas/referenceEntrySchema.js';
import { comparableCode } from '../domain/services/catalogCompletion.js';

import { db } from './indexed-db.js';

/**
 * Unico caminho de leitura e escrita da base de referencia, como o repositorio
 * de produtos e o da tabela de produtos. Toda linha gravada passa pelo
 * `ReferenceEntrySchema`, entao nenhum NCM ou codigo de barras fora do contrato
 * do produto chega ao IndexedDB.
 *
 * A base e separada do catalogo. Este modulo nao toca a tabela de produtos, e o
 * repositorio de produtos nao toca esta: zerar o catalogo mantem a base, e a
 * carga da base nao muda nenhum produto. Ela tambem fica fora do arquivo de
 * backup, porque se refaz inteira a partir da planilha.
 *
 * A busca e sempre pelo codigo comparavel, o mesmo que serve de chave: o codigo
 * impresso com zeros a esquerda encontra a linha guardada sem eles.
 */

function toReference(entry) {
  if (!entry) {
    return null;
  }

  const reference = { systemCode: entry.systemCode };

  if (entry.ncm !== undefined) {
    reference.ncm = entry.ncm;
  }

  if (entry.ean !== undefined) {
    reference.ean = entry.ean;
  }

  return reference;
}

/**
 * Troca a base inteira pelas linhas recebidas, numa transacao so, e devolve
 * quantas foram gravadas.
 *
 * Como na troca do catalogo inteiro, a conferencia acontece antes de a
 * transacao abrir: uma linha fora do contrato impede a carga, em vez de
 * interrompe-la pela metade. Depois disso, limpar e gravar sao uma operacao so
 * para o banco — uma falha no meio desfaz as duas pontas, e a base continua
 * como estava.
 *
 * `loadedAt` marca todas as linhas com o mesmo momento, que e a data da ultima
 * carga lida pelas estatisticas.
 */
export async function replaceReferenceEntries(entries, { loadedAt = new Date().toISOString() } = {}) {
  const validated = entries.map((entry) => ReferenceEntrySchema.parse({ ...entry, loadedAt }));

  await db.transaction('rw', db.referenceEntries, async () => {
    await db.referenceEntries.clear();

    if (validated.length > 0) {
      await db.referenceEntries.bulkAdd(validated);
    }
  });

  return validated.length;
}

/** NCM e codigo de barras de um codigo, ou `null` quando ele nao esta na base. */
export async function findReference(code) {
  const key = comparableCode(code);

  if (key === '') {
    return null;
  }

  return toReference(await db.referenceEntries.get(key));
}

/**
 * NCM e codigo de barras de uma lista de codigos, numa leitura so. Devolve um
 * `Map` do codigo como foi pedido para o que a base tem dele; codigo ausente da
 * base nao entra no mapa.
 */
export async function findReferences(codes) {
  const asked = Array.from(new Set(codes)).filter((code) => comparableCode(code) !== '');
  const found = await db.referenceEntries.bulkGet(asked.map((code) => comparableCode(code)));
  const references = new Map();

  asked.forEach((code, index) => {
    if (found[index]) {
      references.set(code, toReference(found[index]));
    }
  });

  return references;
}

/** Total de linhas, quantas tem NCM, quantas tem codigo de barras e a data da ultima carga. */
export async function getReferenceStats() {
  const stats = { total: 0, withNcm: 0, withEan: 0, loadedAt: null };

  await db.referenceEntries.each((entry) => {
    stats.total += 1;

    if (entry.ncm !== undefined) {
      stats.withNcm += 1;
    }

    if (entry.ean !== undefined) {
      stats.withEan += 1;
    }

    if (stats.loadedAt === null || entry.loadedAt > stats.loadedAt) {
      stats.loadedAt = entry.loadedAt;
    }
  });

  return stats;
}

/** Apaga a base inteira. Nao toca o catalogo. */
export function clearReferenceEntries() {
  return db.referenceEntries.clear();
}
