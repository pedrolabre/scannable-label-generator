import { enrichImportRecords, referenceCodesFor } from '../domain/services/productEnrichment.js';
import { findReferences } from '../storage/referenceRepository.js';
import { describeStorageReadError } from '../storage/storageError.js';

/**
 * O passo do lote que consulta a base de referencia, entre a leitura dos
 * arquivos e a conferencia.
 *
 * A busca e uma so por lote, com os codigos distintos, e o dominio recebe o
 * mapa pronto: e o store quem conhece o armazenamento. O passo vem antes da
 * conferencia, para que o relatorio fale do candidato ja completado, e antes da
 * deteccao de codigo repetido, para que o produto do catalogo que ja tem o
 * mesmo NCM e o mesmo codigo de barras seja visto como identico, e nao como
 * conflito.
 *
 * A base nunca impede a importacao. Base vazia nao e falha: nenhum codigo e
 * achado e o lote segue como veio, com as contagens dizendo isso. Leitura que
 * falha tambem deixa o lote como veio, e o motivo fica em `referenceError`.
 *
 * Como os passos de `importBatchUpdates.js`, recebe o `set` do store, entao o
 * estado continua tendo um dono so.
 */
export async function enrichFromReference(set, records) {
  const codes = referenceCodesFor(records);

  if (codes.length === 0) {
    const { summary } = enrichImportRecords(records);

    set({ enrichmentSummary: summary, referenceError: null });

    return records;
  }

  let references;

  try {
    references = await findReferences(codes);
  } catch (error) {
    set({ enrichmentSummary: null, referenceError: describeStorageReadError(error) });

    return records;
  }

  const enriched = enrichImportRecords(records, references);

  set({ enrichmentSummary: enriched.summary, referenceError: null });

  return enriched.records;
}
