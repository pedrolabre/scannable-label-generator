import { useCallback } from 'react';

import { REFERENCE_FILE_EXTENSIONS, SHEET_STATUS, useReferenceStore } from '../../store/useReferenceStore.js';
import ReferenceEntriesSummary from '../completion/ReferenceEntriesSummary.jsx';
import ImportFilePicker from '../import/ImportFilePicker.jsx';
import ImportFileStatusList from '../import/ImportFileStatusList.jsx';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

/**
 * Carga da base pela planilha cadastral, sem passar pelo catalogo.
 *
 * E o mesmo resumo do Completar dados — quantos codigos entram, com que campos
 * e o que fica fora —, com a diferenca de que aqui nenhum produto e comparado
 * nem alterado. O botao so aparece quando a planilha tem linha a guardar, e o
 * nome dele diz que a base inteira e trocada.
 */

const HELP_TEXT = 'Aceita a planilha cadastral .ods. Troca a base inteira; nenhum produto é alterado.';

export default function ReferenceSheetSection() {
  const status = useReferenceStore((state) => state.sheetStatus);
  const files = useReferenceStore((state) => state.sheetFiles);
  const reference = useReferenceStore((state) => state.sheetReference);
  const result = useReferenceStore((state) => state.sheetResult);
  const error = useReferenceStore((state) => state.sheetError);
  const readSheet = useReferenceStore((state) => state.readSheet);
  const confirmSheet = useReferenceStore((state) => state.confirmSheet);

  const isReading = status === SHEET_STATUS.READING;
  const isWriting = status === SHEET_STATUS.WRITING;
  const canConfirm =
    (status === SHEET_STATUS.READY || isWriting) && reference?.entries.length > 0;

  const handleFilesSelected = useCallback(
    (selected) => {
      readSheet(selected);
    },
    [readSheet],
  );

  return (
    <section aria-labelledby="base-carga" className="space-y-3">
      <h3 id="base-carga" className="text-base font-semibold">
        Carregar a planilha
      </h3>

      <ImportFilePicker
        isParsing={isReading || isWriting}
        onFilesSelected={handleFilesSelected}
        extensions={REFERENCE_FILE_EXTENSIONS}
        helpText={HELP_TEXT}
        inputId="reference-files"
      />

      {error ? <InlineAlert>{error}</InlineAlert> : null}

      <ImportFileStatusList files={files} />

      {reference && !isReading ? (
        <ReferenceEntriesSummary summary={reference.summary} result={result} />
      ) : null}

      {canConfirm ? (
        <Button type="button" variant="primary" onClick={confirmSheet} disabled={isWriting}>
          {isWriting ? 'Gravando…' : 'Trocar a base de referência'}
        </Button>
      ) : null}
    </section>
  );
}
