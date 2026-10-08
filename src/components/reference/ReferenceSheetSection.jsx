import { useCallback, useState } from 'react';

import {
  REFERENCE_FILE_EXTENSIONS,
  SHEET_LOAD_MODE,
  SHEET_STATUS,
  useReferenceStore,
} from '../../store/useReferenceStore.js';
import ReferenceEntriesSummary from '../completion/ReferenceEntriesSummary.jsx';
import { formatCount } from '../import/importCounts.js';
import ImportFilePicker from '../import/ImportFilePicker.jsx';
import ImportFileStatusList from '../import/ImportFileStatusList.jsx';
import Button from '../ui/Button.jsx';
import ConfirmModal from '../ui/ConfirmModal.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

/**
 * Carga da base por um arquivo, sem passar pelo catalogo.
 *
 * E o mesmo resumo do Completar dados, sem comparar nem alterar produto. Trocar
 * a base tira dela todo codigo que nao esta no arquivo, e por isso pede
 * confirmacao.
 */

const HELP_TEXT =
  'Aceita .ods, .csv, .json e .txt com colunas de código, NCM e código de barras. Atualiza código por código; nenhum produto é alterado.';

function codes(count) {
  return count === 1 ? '1 código' : `${formatCount(count)} códigos`;
}

function replaceSentence(entryCount, preview) {
  const kept = `${codes(entryCount)} do arquivo ${entryCount === 1 ? 'fica' : 'ficam'} na base.`;

  if (!preview) {
    return `${kept} Os códigos que não estão no arquivo saem da base.`;
  }

  const removed = preview.removedOnReplace;

  if (removed === 0) {
    return `${kept} Todos os códigos guardados estão no arquivo; nenhum sai da base.`;
  }

  return `${kept} ${codes(removed)} que não ${removed === 1 ? 'está' : 'estão'} no arquivo ${removed === 1 ? 'sai' : 'saem'} da base.`;
}

export default function ReferenceSheetSection() {
  const status = useReferenceStore((state) => state.sheetStatus);
  const files = useReferenceStore((state) => state.sheetFiles);
  const reference = useReferenceStore((state) => state.sheetReference);
  const result = useReferenceStore((state) => state.sheetResult);
  const error = useReferenceStore((state) => state.sheetError);
  const readSheet = useReferenceStore((state) => state.readSheet);
  const confirmSheet = useReferenceStore((state) => state.confirmSheet);
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);

  const isReading = status === SHEET_STATUS.READING;
  const isWriting = status === SHEET_STATUS.WRITING;
  const canConfirm = (status === SHEET_STATUS.READY || isWriting) && reference?.entries.length > 0;

  const handleFilesSelected = useCallback(
    (selected) => {
      readSheet(selected);
    },
    [readSheet],
  );

  async function handleReplace() {
    await confirmSheet(SHEET_LOAD_MODE.REPLACE);
    setIsConfirmingReplace(false);
  }

  return (
    <section aria-labelledby="base-carga" className="space-y-3">
      <h3 id="base-carga" className="text-base font-semibold">
        Carregar arquivo
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
        <ReferenceEntriesSummary
          summary={reference.summary}
          preview={reference.preview}
          result={result}
        />
      ) : null}

      {canConfirm ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => confirmSheet(SHEET_LOAD_MODE.MERGE)}
            disabled={isWriting}
          >
            {isWriting && !isConfirmingReplace ? 'Gravando…' : 'Atualizar a base'}
          </Button>
          <Button type="button" onClick={() => setIsConfirmingReplace(true)} disabled={isWriting}>
            Trocar a base
          </Button>
        </div>
      ) : null}

      {isConfirmingReplace ? (
        <ConfirmModal
          title="Trocar a base de referência"
          subtitle="A base passa a ter só os códigos do arquivo"
          confirmLabel="Trocar a base"
          isConfirming={isWriting}
          onConfirm={handleReplace}
          onCancel={() => setIsConfirmingReplace(false)}
        >
          <p>{replaceSentence(reference?.entries.length ?? 0, reference?.preview)}</p>
          <p>O catálogo fica como está. Para só somar o arquivo à base, use Atualizar a base.</p>
        </ConfirmModal>
      ) : null}
    </section>
  );
}
