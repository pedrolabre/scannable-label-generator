import { useCallback, useRef, useState } from 'react';

import { generateSymbol } from '../../lib/barcode.js';
import { downloadBlob } from '../../lib/download.js';
import { renderPrintDocument } from '../../lib/pdf.js';
import { describePrintDocument } from '../../domain/services/printDocument.js';
import {
  buildExportFileName,
  describeExportProgress,
  describeSymbolProgress,
  listExportSymbolTexts,
} from '../../domain/services/printExport.js';
import { useLabelHeader } from '../../store/useLabelSettingsStore.js';

/**
 * Estado da exportacao e a sequencia que a executa.
 *
 * A sequencia e sempre a mesma: gerar um simbolo por exemplar da tiragem,
 * descrever o documento, gerar os bytes cedendo o laco de eventos entre
 * folhas, e disparar o download. Cada copia tem texto proprio, entao a tiragem
 * inteira pede um simbolo por etiqueta; a geracao anda em lotes e cede o laco
 * de eventos entre eles, com o andamento escrito no mesmo lugar do andamento
 * das folhas.
 *
 * O nome da empresa e o parcelamento sao lidos da configuracao na hora do
 * clique, os mesmos que a previa desenha.
 *
 * Simbolo recusado nao interrompe a exportacao: ele entra no mapa como falha e
 * a etiqueta correspondente sai com o marcador, como a tela ja mostra.
 *
 * Duas exportacoes ao mesmo tempo sao impedidas aqui, e nao so pelo botao
 * desabilitado: o estado da tela pode mudar entre o clique e o proximo desenho.
 */

const FAILURE_MESSAGE =
  'Não foi possível gerar o PDF das etiquetas. Tente de novo.';

export const EXPORT_STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  FAILED: 'failed',
});

/** Simbolos por lote: poucos o bastante para a tela responder entre um lote e outro. */
const SYMBOL_BATCH_SIZE = 50;

function yieldToEventLoop() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function resolveSymbols(texts, onProgress) {
  const resolved = new Map();

  for (let start = 0; start < texts.length; start += SYMBOL_BATCH_SIZE) {
    const batch = texts.slice(start, start + SYMBOL_BATCH_SIZE);
    const entries = await Promise.all(
      batch.map((text) =>
        generateSymbol(text)
          .then((symbol) => [text, { symbol, error: null }])
          .catch((error) => [text, { symbol: null, error }]),
      ),
    );

    entries.forEach(([text, result]) => resolved.set(text, result));
    onProgress(Math.min(start + batch.length, texts.length), texts.length);

    if (start + SYMBOL_BATCH_SIZE < texts.length) {
      await yieldToEventLoop();
    }
  }

  return resolved;
}

export function usePrintExport() {
  const [status, setStatus] = useState(EXPORT_STATUS.IDLE);
  const [message, setMessage] = useState(null);
  const runningRef = useRef(false);
  const header = useLabelHeader();

  const exportJob = useCallback(async ({ job, sheet, labelLayout, grid, products }) => {
    if (runningRef.current) {
      return;
    }

    runningRef.current = true;
    setStatus(EXPORT_STATUS.RUNNING);
    setMessage(null);

    try {
      const symbols = await resolveSymbols(listExportSymbolTexts(job.items, products), (done, total) => {
        setMessage(describeSymbolProgress(done, total));
      });
      const description = describePrintDocument({
        job,
        sheet,
        labelLayout,
        grid,
        products,
        symbols,
        header,
      });

      const bytes = await renderPrintDocument(description, {
        createdAt: new Date(),
        onProgress: (sheetIndex, totalSheets) => {
          setMessage(describeExportProgress(sheetIndex, totalSheets));
        },
      });

      downloadBlob(
        new Blob([bytes], { type: 'application/pdf' }),
        buildExportFileName(new Date(), job.labelLayoutId),
      );

      setStatus(EXPORT_STATUS.IDLE);
      setMessage(null);
    } catch {
      setStatus(EXPORT_STATUS.FAILED);
      setMessage(FAILURE_MESSAGE);
    } finally {
      runningRef.current = false;
    }
  }, [header]);

  return { status, message, exportJob };
}
