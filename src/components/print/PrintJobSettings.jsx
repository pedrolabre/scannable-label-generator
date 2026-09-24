import { usePrintJobStore } from '../../store/usePrintJobStore.js';

import LabelLayoutPicker from '../label/LabelLayoutPicker.jsx';
import ShellColumn from '../layout/ShellColumn.jsx';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

import PrintExportControls from './PrintExportControls.jsx';
import PrintJobItemRow from './PrintJobItemRow.jsx';
import SheetFitToggle from './SheetFitToggle.jsx';
import SheetLayoutPicker from './SheetLayoutPicker.jsx';
import SheetMarginFields from './SheetMarginFields.jsx';
import { COMPACT_SHEET_ADJUSTMENTS } from './printInputs.js';

/**
 * Coluna da esquerda: o que foi marcado na listagem, quantas etiquetas de cada,
 * em qual modelo de etiqueta e em qual folha.
 *
 * Ela configura e nada mais. O desenho da folha mora num dialogo proprio,
 * aberto por `Prévia da folha`, porque dentro da coluna ele so cabia rolando
 * de lado dentro de uma coluna que ja rola na vertical. O rodape fixo guarda os
 * dois passos seguintes, a previa e a exportacao, sempre a vista por mais longa
 * que seja a selecao.
 *
 * A leitura do trabalho chega pronta de quem montou a tela, e e a mesma que o
 * dialogo desenha e a linha de estado conta. Daqui saem so as mudancas: o que o
 * operador marca e digita vai direto para o store.
 *
 * O modelo de etiqueta daqui e proprio, e nao o da previa individual. O da
 * previa e ajuste de quem esta olhando agora; amarrar a tiragem a ele faria a
 * conferencia de uma etiqueta trocar a folha inteira em silencio. Os dois nao
 * precisam concordar, e so este alcanca o trabalho.
 */

function PrintPlaceholder({ state, children }) {
  return (
    <div
      data-print-state={state}
      className="flex items-center justify-center border border-dashed border-neutro-bordaForte px-6 py-10 text-center text-sm text-neutro-tintaFraca"
    >
      <p>{children}</p>
    </div>
  );
}

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function describeReady({ totalCopies, jobItems }) {
  return `Configuração pronta: ${plural(totalCopies, 'etiqueta', 'etiquetas')} em ${plural(
    jobItems.length,
    'produto',
    'produtos',
  )}.`;
}

function describeMissingSymbols(count) {
  return count === 1
    ? '1 produto selecionado não gera símbolo e sai com o restante do conteúdo.'
    : `${count} produtos selecionados não geram símbolo e saem com o restante do conteúdo.`;
}

export default function PrintJobSettings({
  products = [],
  printState,
  exporter,
  onOpenSheetPreview,
}) {
  const labelLayoutId = usePrintJobStore((state) => state.labelLayoutId);
  const sheetLayoutId = usePrintJobStore((state) => state.sheetLayoutId);
  const sheetAdjustments = usePrintJobStore((state) => state.sheetAdjustments);
  const setCopies = usePrintJobStore((state) => state.setCopies);
  const setLabelLayoutId = usePrintJobStore((state) => state.setLabelLayoutId);
  const setSheetLayoutId = usePrintJobStore((state) => state.setSheetLayoutId);
  const setSheetAdjustment = usePrintJobStore((state) => state.setSheetAdjustment);
  const setSheetAdjustments = usePrintJobStore((state) => state.setSheetAdjustments);
  const restoreSheetAdjustments = usePrintJobStore((state) => state.restoreSheetAdjustments);
  const toggleProduct = usePrintJobStore((state) => state.toggleProduct);
  const clearSelection = usePrintJobStore((state) => state.clearSelection);

  const {
    items,
    fieldErrors,
    blockingMessage,
    isReady,
    missingSymbolCount,
    job,
    sheet,
    labelLayout,
    grid,
    totalSheets,
    canCompact,
  } = printState;

  const exportRequest = isReady ? { job, sheet, labelLayout, grid, products } : null;

  function renderSummary() {
    if (blockingMessage) {
      return (
        <div data-print-status="blocked">
          <InlineAlert>{blockingMessage}</InlineAlert>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5" data-print-summary="">
        <p data-print-status="ready" className="text-sm text-neutro-tintaMedia">
          {describeReady(printState)}
        </p>
        <dl className="flex flex-col text-rotulo text-neutro-tintaMedia">
          <div className="flex justify-between gap-3 border-b border-neutro-superficie py-1.5">
            <dt>Papel</dt>
            <dd className="font-medium">{sheet.name}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <dt>Folhas</dt>
            <dd className="font-medium tabular-nums" data-print-sheets={totalSheets}>
              {totalSheets}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  function renderBody() {
    if (products.length === 0) {
      return (
        <PrintPlaceholder state="empty-catalog">
          Cadastre ou importe produtos para montar uma folha de etiquetas.
        </PrintPlaceholder>
      );
    }

    return (
      <>
        <div className="flex flex-col gap-4">
          <LabelLayoutPicker
            legend="Modelo das etiquetas"
            name="modelo-etiqueta-impressao"
            value={labelLayoutId}
            onChange={setLabelLayoutId}
          />
          <SheetLayoutPicker value={sheetLayoutId} onChange={setSheetLayoutId} />
        </div>

        <SheetFitToggle
          adjustments={sheetAdjustments}
          available={canCompact}
          onCompact={() => setSheetAdjustments(COMPACT_SHEET_ADJUSTMENTS)}
          onRestore={restoreSheetAdjustments}
        />

        <SheetMarginFields
          values={sheetAdjustments}
          errors={fieldErrors}
          onChange={setSheetAdjustment}
        />

        {items.length === 0 ? (
          <PrintPlaceholder state="no-selection">
            Marque na listagem os produtos que vão para a folha.
          </PrintPlaceholder>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-rotulo font-semibold text-neutro-tinta">
                Produtos selecionados{' '}
                <span data-print-selected-count={items.length}>({items.length})</span>
              </h3>
              <Button onClick={clearSelection}>Limpar seleção</Button>
            </div>

            <ul>
              {items.map((entry) => (
                <PrintJobItemRow
                  key={entry.product.id}
                  product={entry.product}
                  copies={entry.copies}
                  copiesError={entry.parsed.error}
                  hasSymbol={entry.hasSymbol}
                  onCopiesChange={setCopies}
                  onRemove={toggleProduct}
                />
              ))}
            </ul>

            {missingSymbolCount > 0 ? (
              <p
                data-symbol-warning={missingSymbolCount}
                className="border border-marca-amareloBorda bg-marca-amareloTenue p-3 text-xs leading-snug text-marca-amareloTexto"
              >
                {describeMissingSymbols(missingSymbolCount)}
              </p>
            ) : null}
          </div>
        )}

        {renderSummary()}
      </>
    );
  }

  return (
    <ShellColumn
      title="Trabalho de impressão"
      label="Trabalho de impressão"
      className="border-r border-neutro-borda bg-neutro-branco"
      bodyClassName="flex flex-col gap-5 lg:gap-4"
      data-print-job-settings={isReady ? 'ready' : 'blocked'}
      footer={
        products.length > 0 ? (
          <PrintExportControls
            exporter={exporter}
            request={exportRequest}
            leadingAction={
              <Button
                className="w-full"
                disabled={!isReady}
                onClick={onOpenSheetPreview}
                data-sheet-preview-trigger=""
              >
                Prévia da folha
              </Button>
            }
          />
        ) : null
      }
    >
      {renderBody()}
    </ShellColumn>
  );
}
