import { useCallback } from 'react';

import { COMPLETION_FILE_EXTENSIONS } from '../../domain/services/importService.js';
import { COMPLETION_STATUS, useCompletionStore } from '../../store/useCompletionStore.js';
import ImportFilePicker from '../import/ImportFilePicker.jsx';
import ImportFileStatusList from '../import/ImportFileStatusList.jsx';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';
import ModalShell from '../ui/ModalShell.jsx';

import CatalogCompletionSummary from './CatalogCompletionSummary.jsx';

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
 * confirmacao. Como na importacao, o dialogo nao fecha no clique fora e fechar
 * nao descarta o que foi lido.
 */

const HELP_TEXT =
  'Aceita a planilha .ods e os mesmos arquivos da importação. Só preenche campos vazios dos produtos já cadastrados; nenhum produto é criado.';

export default function CatalogCompletionPanel({ onClose }) {
  const status = useCompletionStore((state) => state.status);
  const files = useCompletionStore((state) => state.files);
  const plan = useCompletionStore((state) => state.plan);
  const result = useCompletionStore((state) => state.result);
  const error = useCompletionStore((state) => state.error);
  const readFiles = useCompletionStore((state) => state.readFiles);
  const confirm = useCompletionStore((state) => state.confirm);
  const reset = useCompletionStore((state) => state.reset);

  const isReading = status === COMPLETION_STATUS.READING;
  const isWriting = status === COMPLETION_STATUS.WRITING;
  const isBusy = isReading || isWriting;
  const canConfirm =
    (status === COMPLETION_STATUS.READY || isWriting) && plan?.summary.updatedProducts > 0;

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
              {isWriting ? 'Gravando…' : 'Completar catálogo'}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-neutro-tintaMedia">
          Compara cada código do arquivo com o catálogo deste dispositivo. O que já está preenchido
          fica como está, e código que não está cadastrado é ignorado.
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
      </div>
    </ModalShell>
  );
}
