import { useCallback } from 'react';

import { COMPLETION_FILE_EXTENSIONS } from '../../domain/services/importService.js';
import { COMPLETION_STATUS, useCompletionStore } from '../../store/useCompletionStore.js';
import ImportFilePicker from '../import/ImportFilePicker.jsx';
import ImportFileStatusList from '../import/ImportFileStatusList.jsx';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';
import ModalShell from '../ui/ModalShell.jsx';

import CatalogCompletionSummary from './CatalogCompletionSummary.jsx';
import ReferenceEntriesSummary from './ReferenceEntriesSummary.jsx';

/**
 * Dialogo da complementacao do catalogo.
 *
 * Ele e irmao do dialogo de importacao, e nao uma aba dele, porque o efeito e
 * o oposto: a importacao cria produtos, e este dialogo nunca cria nenhum. Ele
 * le os arquivos, compara com o que ja esta cadastrado e preenche so os campos
 * vazios. E o caminho da planilha cadastral, que traz o NCM e o codigo de
 * barras mas nao traz preco.
 *
 * O resumo aparece antes de qualquer gravacao, e o botao de completar e a
 * confirmacao. Com a planilha `.ods`, a mesma confirmacao guarda as linhas
 * dela na base de referencia; sem produto a completar, o botao so guarda a
 * base, e o nome dele diz isso. Como na importacao, o dialogo nao fecha no clique fora e fechar
 * nao descarta o que foi lido.
 */

const HELP_TEXT =
  'Aceita a planilha .ods e os mesmos arquivos da importação. Só preenche campos vazios dos produtos já cadastrados; nenhum produto é criado.';

export default function CatalogCompletionPanel({ onClose }) {
  const status = useCompletionStore((state) => state.status);
  const files = useCompletionStore((state) => state.files);
  const plan = useCompletionStore((state) => state.plan);
  const result = useCompletionStore((state) => state.result);
  const reference = useCompletionStore((state) => state.reference);
  const referenceResult = useCompletionStore((state) => state.referenceResult);
  const error = useCompletionStore((state) => state.error);
  const readFiles = useCompletionStore((state) => state.readFiles);
  const confirm = useCompletionStore((state) => state.confirm);
  const reset = useCompletionStore((state) => state.reset);

  const isReading = status === COMPLETION_STATUS.READING;
  const isWriting = status === COMPLETION_STATUS.WRITING;
  const isBusy = isReading || isWriting;
  const hasProductsToComplete = plan?.summary.updatedProducts > 0;
  const hasReferenceToStore = reference?.summary.entryCount > 0;
  const canConfirm =
    (status === COMPLETION_STATUS.READY || isWriting) && (hasProductsToComplete || hasReferenceToStore);
  const confirmLabel = hasProductsToComplete ? 'Completar catálogo' : 'Guardar base de referência';

  const handleFilesSelected = useCallback(
    (selected) => {
      readFiles(selected);
    },
    [readFiles],
  );

  const handleConfirm = useCallback(() => {
    confirm();
  }, [confirm]);

  return (
    <ModalShell
      title="Completar dados"
      subtitle="Preenche só os campos vazios dos produtos já cadastrados."
      width={640}
      closeOnBackdrop={false}
      onClose={onClose}
      footer={
        <>
          {files.length > 0 && !isBusy ? (
            <Button type="button" onClick={reset}>
              Limpar
            </Button>
          ) : null}
          <Button type="button" onClick={onClose} disabled={isBusy}>
            Fechar
          </Button>
          {canConfirm ? (
            <Button type="button" variant="primary" onClick={handleConfirm} disabled={isWriting}>
              {isWriting ? 'Gravando…' : confirmLabel}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-neutro-tintaMedia">
          Compara cada código do arquivo com o catálogo deste dispositivo. O que já está preenchido
          fica como está, e código que não está cadastrado é ignorado. A planilha .ods também fica
          guardada neste navegador como base de referência de NCM e código de barras.
        </p>

        <ImportFilePicker
          isParsing={isBusy}
          onFilesSelected={handleFilesSelected}
          extensions={COMPLETION_FILE_EXTENSIONS}
          helpText={HELP_TEXT}
          inputId="completion-files"
        />

        {error ? <InlineAlert>{error}</InlineAlert> : null}

        <ImportFileStatusList files={files} />

        {plan && !isReading ? (
          <CatalogCompletionSummary
            summary={result ?? plan.summary}
            isDone={status === COMPLETION_STATUS.DONE}
          />
        ) : null}

        {reference && !isReading ? (
          <ReferenceEntriesSummary summary={reference.summary} result={referenceResult} />
        ) : null}
      </div>
    </ModalShell>
  );
}
