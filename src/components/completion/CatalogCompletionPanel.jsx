import { useCallback, useState } from 'react';

import { COMPLETION_FILE_EXTENSIONS } from '../../domain/services/importService.js';
import { DIVERGENCE_STATUS } from '../../store/divergenceWrite.js';
import { COMPLETION_STATUS, useCompletionStore } from '../../store/useCompletionStore.js';
import DivergenceDialog from '../divergence/DivergenceDialog.jsx';
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
 * vazios — e e o caminho do arquivo de cadastro, que traz o NCM e o codigo de
 * barras mas nao traz preco.
 *
 * O resumo aparece antes de qualquer gravacao, e o botao de completar e a
 * confirmacao. Com arquivo em colunas que traz NCM ou codigo de barras, a mesma
 * confirmacao atualiza a base de referencia; sem produto a completar, o botao
 * so atualiza a base, e o nome dele diz isso. Como na importacao, o dialogo nao
 * fecha no clique fora e fechar nao descarta o que foi lido.
 */

const HELP_TEXT =
  'Aceita planilhas .ods e .csv, listas .json, notas fiscais .xml e arquivos .txt (relatório do ERP ou separado por tabulação). Nenhum produto é criado.';

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
  const divergenceStatus = useCompletionStore((state) => state.divergenceStatus);
  const divergenceResult = useCompletionStore((state) => state.divergenceResult);
  const divergenceError = useCompletionStore((state) => state.divergenceError);
  const applyDivergences = useCompletionStore((state) => state.applyDivergences);
  const [isReviewing, setIsReviewing] = useState(false);

  const isReading = status === COMPLETION_STATUS.READING;
  const isWriting = status === COMPLETION_STATUS.WRITING;
  const isBusy = isReading || isWriting;
  const hasProductsToComplete = plan?.summary.updatedProducts > 0;
  const hasReferenceToStore = reference?.summary.entryCount > 0;
  const canConfirm =
    (status === COMPLETION_STATUS.READY || isWriting) && (hasProductsToComplete || hasReferenceToStore);
  const confirmLabel = hasProductsToComplete ? 'Completar catálogo' : 'Atualizar a base de referência';
  const divergences = plan?.divergences ?? [];
  const canReview = !isReading && divergences.length > 0;

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
      subtitle="Preenche campos vazios e aponta divergências nos produtos já cadastrados."
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
          {canReview ? (
            <Button
              type="button"
              onClick={() => setIsReviewing(true)}
              disabled={isWriting}
              data-abrir-divergencias=""
            >
              {`Divergências (${divergences.length.toLocaleString('pt-BR')})`}
            </Button>
          ) : null}
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
          Compara cada código do arquivo com os produtos cadastrados neste navegador. Campo vazio é
          preenchido. Descrição, preço ou NCM diferentes aparecem em Divergências, para você
          escolher entre mudar e manter. Código que não está cadastrado é ignorado. Código, NCM e
          código de barras do arquivo também atualizam a base de referência.
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
          <ReferenceEntriesSummary
            summary={reference.summary}
            preview={reference.preview}
            result={referenceResult}
          />
        ) : null}
      </div>

      {isReviewing ? (
        <DivergenceDialog
          divergences={divergences}
          isApplying={divergenceStatus === DIVERGENCE_STATUS.APPLYING}
          result={divergenceResult}
          error={divergenceError}
          onApply={applyDivergences}
          onClose={() => setIsReviewing(false)}
        />
      ) : null}
    </ModalShell>
  );
}
