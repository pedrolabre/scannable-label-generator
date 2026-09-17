import { useCallback, useRef, useState } from 'react';

import { generateSymbol } from '../../lib/barcode.js';
import { downloadBlob } from '../../lib/download.js';
import { renderPrintDocument } from '../../lib/pdf.js';
import { describePrintDocument } from '../../domain/services/printDocument.js';
import {
  buildExportFileName,
  describeExportProgress,
  listExportSystemCodes,
} from '../../domain/services/printExport.js';

/**
 * Estado da exportacao e a sequencia que a executa.
 *
 * A sequencia e sempre a mesma: gerar um simbolo por codigo distinto da
 * tiragem, descrever o documento, gerar os bytes cedendo o laco de eventos
 * entre folhas, e disparar o download. O gerador de simbolo ja tem cache
 * proprio, entao os codigos que a previa desenhou nao sao gerados de novo.
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

async function resolveSymbols(codes) {
  const entries = await Promise.all(
    codes.map((code) =>
      generateSymbol(code)
        .then((symbol) => [code, { symbol, error: null }])
        .catch((error) => [code, { symbol: null, error }]),
    ),
  );

  return new Map(entries);
}

export function usePrintExport() {
  const [status, setStatus] = useState(EXPORT_STATUS.IDLE);
  const [message, setMessage] = useState(null);
  const runningRef = useRef(false);

  const exportJob = useCallback(async ({ job, sheet, labelLayout, grid, products }) => {
    if (runningRef.current) {
      return;
    }

    runningRef.current = true;
    setStatus(EXPORT_STATUS.RUNNING);
    setMessage(null);

    try {
      const symbols = await resolveSymbols(listExportSystemCodes(job.items, products));
      const description = describePrintDocument({ job, sheet, labelLayout, grid, products, symbols });

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
  }, []);

  return { status, message, exportJob };
}
