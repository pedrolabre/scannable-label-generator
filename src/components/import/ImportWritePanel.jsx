import { useCallback, useMemo, useState } from 'react';

import { writableCount } from '../../domain/services/importReportIndex.js';
import { useImportStore } from '../../store/useImportStore.js';
import Button from '../ui/Button.jsx';
import ConfirmModal from '../ui/ConfirmModal.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

import { formatCount, pluralize } from './importCounts.js';
import ImportWriteResult from './ImportWriteResult.jsx';

/**
 * A gravacao do lote: quantos registros vao entrar, a confirmacao, o progresso e
 * o resultado.
 *
 * O numero no botao nao vem de uma varredura do lote. Ele sai das contagens do
 * relatorio, descontando o que o mapa de conflitos — pequeno — diz que nao entra:
 * o registro que ja esta no catalogo igual ao do arquivo, o que o usuario decidiu
 * pular e o que ja entrou numa gravacao anterior. Varrer duzentos mil registros a
 * cada clique para escrever um numero na tela seria o caminho mais caro possivel.
 *
 * A confirmacao existe por causa de um verbo so: substituir regrava um produto
 * que ja estava no catalogo, e essa e a unica acao deste fluxo que altera algo
 * que o usuario nao acabou de escolher. O dialogo diz quantos serao.
 *
 * "Interromper" para entre fatias, e nao no meio de uma. E por isso que o que
 * ficou gravado e sempre um trecho inteiro do lote, e que continuar depois e so
 * seguir de onde parou.
 */
export default function ImportWritePanel() {
  const report = useImportStore((state) => state.report);
  const isWriting = useImportStore((state) => state.isWriting);
  const writtenCount = useImportStore((state) => state.writtenCount);
  const writeTotal = useImportStore((state) => state.writeTotal);
  const writeResult = useImportStore((state) => state.writeResult);
  const writeError = useImportStore((state) => state.writeError);
  const catalogError = useImportStore((state) => state.catalogError);
  const summary = useImportStore((state) => state.conflictSummary);
  const writeBatch = useImportStore((state) => state.writeBatch);
  const stopWriting = useImportStore((state) => state.stopWriting);

  const [isConfirming, setIsConfirming] = useState(false);

  const counts = useMemo(() => {
    if (!report) {
      return { toWrite: 0, toReplace: 0 };
    }

    const held = (summary?.identical ?? 0) + (summary?.toSkip ?? 0);
    const alreadyWritten = writeResult?.writtenIds?.size ?? 0;

    return {
      toWrite: Math.max(writableCount(report) - held - alreadyWritten, 0),
      toReplace: summary?.toReplace ?? 0,
    };
  }, [report, summary, writeResult]);

  const handleConfirm = useCallback(() => {
    setIsConfirming(false);
    writeBatch();
  }, [writeBatch]);

  if (!report) {
    return null;
  }

  if (catalogError) {
    return (
      <InlineAlert>
        {`${catalogError} Sem ler o catálogo não é possível saber quais códigos já existem, então a gravação fica indisponível.`}
      </InlineAlert>
    );
  }

  if (isWriting) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p role="status" className="text-sm text-neutro-tintaFraca">
          Gravando {formatCount(writtenCount)} de {formatCount(writeTotal)} registros…
        </p>

        <Button type="button" onClick={stopWriting}>
          Interromper
        </Button>
      </div>
    );
  }

  const isResuming = Boolean(writeResult) && counts.toWrite > 0;

  return (
    <div className="space-y-3">
      <ImportWriteResult result={writeResult} error={writeError} />

      {writeError && !writeResult ? <InlineAlert>{writeError}</InlineAlert> : null}

      {counts.toWrite > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary" onClick={() => setIsConfirming(true)}>
            {isResuming
              ? `Continuar a gravação (${formatCount(counts.toWrite)})`
              : `Gravar ${pluralize(counts.toWrite, 'registro', 'registros')} no catálogo`}
          </Button>

          {report.pendingCount > 0 ? (
            <p className="text-sm text-neutro-tintaFraca">
              {pluralize(report.pendingCount, 'registro fica de fora', 'registros ficam de fora')} até
              você decidir o que fazer com o código repetido.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-neutro-tintaFraca">
          {report.pendingCount > 0
            ? 'Decida o que fazer com os códigos repetidos para que o lote possa ser gravado.'
            : 'Nenhum registro deste lote está pronto para o catálogo.'}
        </p>
      )}

      {isConfirming ? (
        <ConfirmModal
          title="Gravar o lote no catálogo?"
          confirmLabel="Gravar"
          onConfirm={handleConfirm}
          onCancel={() => setIsConfirming(false)}
        >
          <p>
            {pluralize(counts.toWrite, 'registro será gravado', 'registros serão gravados')} no
            catálogo deste dispositivo.
          </p>

          {counts.toReplace > 0 ? (
            <p>
              {pluralize(
                counts.toReplace,
                'deles substitui um produto que já está gravado',
                'deles substituem produtos que já estão gravados',
              )}
              , como você decidiu na revisão.
            </p>
          ) : null}
        </ConfirmModal>
      ) : null}
    </div>
  );
}
