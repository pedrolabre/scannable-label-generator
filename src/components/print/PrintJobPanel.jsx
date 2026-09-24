import { canEncodeSystemCode } from '../../lib/barcodeSymbology.js';
import { findLabelLayout } from '../../domain/services/labelLayoutCatalog.js';
import {
  buildPrintJob,
  buildSheetLayout,
  countCopies,
} from '../../domain/services/printJobBuilder.js';
import { computeSheetGrid, describeEmptyGrid } from '../../domain/services/sheetGrid.js';
import { usePrintJobStore } from '../../store/usePrintJobStore.js';

import LabelLayoutPicker from '../label/LabelLayoutPicker.jsx';
import ShellColumn from '../layout/ShellColumn.jsx';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

import PrintExportControls from './PrintExportControls.jsx';
import PrintJobItemRow from './PrintJobItemRow.jsx';
import SheetLayoutPicker from './SheetLayoutPicker.jsx';
import SheetMarginFields from './SheetMarginFields.jsx';
import SheetPreview from './SheetPreview.jsx';
import { SHEET_FIELDS, parseCopies, parseMillimeters } from './printInputs.js';
import { resolvePrintItems } from './printSelection.js';

/**
 * Coluna da esquerda: o que foi marcado na listagem, quantas etiquetas de cada,
 * em qual modelo de etiqueta e em qual folha.
 *
 * Ela abre a tela, a esquerda da listagem, porque e o trabalho que a listagem
 * alimenta: marcar um produto la move um numero daqui.
 *
 * O painel ainda faz tres coisas numa coluna de 320 px — configura, desenha a
 * folha e exporta. O desenho da folha e o que nao cabe: ele sai daqui para um
 * dialogo proprio, e o rodape fixo desta coluna recebe os dois botoes que hoje
 * moram no meio do corpo. Isso e reparticao de responsabilidade, nao de estilo,
 * e por isso nao acontece junto com a mudanca de lugar de todos os paineis.
 *
 * A folha so e desenhada quando a configuracao inteira vale. Etiqueta que nao
 * cabe na area util bloqueia o trabalho como qualquer outra recusa, e o motivo
 * aparece no mesmo aviso ao pe do painel.
 *
 * O modelo de etiqueta daqui e proprio, e nao o da previa individual. O da
 * previa e ajuste de quem esta olhando agora; amarrar a tiragem a ele faria
 * rolar a pagina para conferir uma etiqueta trocar a folha inteira em silencio.
 * Os dois nao precisam concordar, e so este alcanca o trabalho.
 *
 * O painel nao le o armazenamento: a lista de produtos chega pronta de quem
 * montou a tela, como no painel da previa. A selecao guarda identificador, entao
 * produto editado continua marcado, produto removido sai sozinho e a listagem
 * relida nao derruba nada.
 */

function PrintPlaceholder({ state, children }) {
  return (
    <div
      data-print-state={state}
      className="flex items-center justify-center rounded border border-dashed border-neutro-bordaForte px-6 py-10 text-center text-sm text-neutro-tintaFraca"
    >
      <p>{children}</p>
    </div>
  );
}

export default function PrintJobPanel({ products = [] }) {
  const selection = usePrintJobStore((state) => state.selection);
  const labelLayoutId = usePrintJobStore((state) => state.labelLayoutId);
  const sheetLayoutId = usePrintJobStore((state) => state.sheetLayoutId);
  const sheetAdjustments = usePrintJobStore((state) => state.sheetAdjustments);
  const setCopies = usePrintJobStore((state) => state.setCopies);
  const setLabelLayoutId = usePrintJobStore((state) => state.setLabelLayoutId);
  const setSheetLayoutId = usePrintJobStore((state) => state.setSheetLayoutId);
  const setSheetAdjustment = usePrintJobStore((state) => state.setSheetAdjustment);
  const toggleProduct = usePrintJobStore((state) => state.toggleProduct);
  const clearSelection = usePrintJobStore((state) => state.clearSelection);

  const items = resolvePrintItems(products, selection).map((entry) => ({
    ...entry,
    parsed: parseCopies(entry.copies),
    hasSymbol: canEncodeSystemCode(entry.product.systemCode),
  }));

  // Os seis numeros da folha sao lidos do texto antes de chegarem ao contrato.
  // Campo que nao le mantem o valor do modelo na montagem: o erro dele ja
  // bloqueia o trabalho, e recusar a folha inteira por um campo em edicao
  // esconderia as outras recusas.
  const fieldErrors = {};
  const adjustments = {};

  SHEET_FIELDS.forEach((field) => {
    const { value, error } = parseMillimeters(sheetAdjustments[field.key], field);

    if (error) {
      fieldErrors[field.key] = error;
      return;
    }

    adjustments[field.key] = value;
  });

  const { sheet, errors: sheetErrors } = buildSheetLayout(sheetLayoutId, adjustments);

  Object.entries(sheetErrors.fields).forEach(([key, message]) => {
    if (!(key in fieldErrors)) {
      fieldErrors[key] = message;
    }
  });

  const jobItems = items
    .filter((entry) => entry.parsed.error === null)
    .map((entry) => ({ productId: entry.product.id, copies: entry.parsed.value }));

  const { job, errors: jobErrors } = buildPrintJob({ labelLayoutId, sheetLayoutId, items: jobItems });

  const firstSheetError =
    SHEET_FIELDS.map((field) => fieldErrors[field.key]).find(Boolean) ?? sheetErrors.general[0];
  const firstCopiesError = items.map((entry) => entry.parsed.error).find(Boolean);
  const firstJobError =
    Object.values(jobErrors.fields)[0] ?? jobErrors.general[0] ?? null;

  const configMessage = firstSheetError ?? firstCopiesError ?? firstJobError ?? null;
  const canDraw = Boolean(sheet) && Boolean(job) && !configMessage;

  const labelLayout = findLabelLayout(labelLayoutId);
  const grid = canDraw && labelLayout ? computeSheetGrid(sheet, labelLayout) : null;
  const capacityMessage = grid && grid.perSheet === 0 ? describeEmptyGrid(grid, labelLayout) : null;

  const blockingMessage = configMessage ?? capacityMessage;
  const isReady = canDraw && Boolean(grid) && !blockingMessage;

  const missingSymbolCount = items.filter((entry) => !entry.hasSymbol).length;
  const totalCopies = countCopies(jobItems);

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

        <SheetMarginFields
          values={sheetAdjustments}
          errors={fieldErrors}
          onChange={setSheetAdjustment}
        />

        {items.length === 0 ? (
          <PrintPlaceholder state="no-selection">
            Marque na listagem acima os produtos que vão para a folha.
          </PrintPlaceholder>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold">
                Produtos selecionados ({items.length})
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
                data-symbol-warning=""
                className="text-xs text-marca-amareloTexto"
              >
                {missingSymbolCount === 1
                  ? '1 produto selecionado não gera símbolo e sai com o restante do conteúdo.'
                  : `${missingSymbolCount} produtos selecionados não geram símbolo e saem com o restante do conteúdo.`}
              </p>
            ) : null}
          </div>
        )}

        {blockingMessage ? (
          <div data-print-status="blocked">
            <InlineAlert>{blockingMessage}</InlineAlert>
          </div>
        ) : isReady ? (
          <PrintExportControls
            job={job}
            sheet={sheet}
            labelLayout={labelLayout}
            grid={grid}
            products={products}
            canExport={isReady && jobItems.length > 0}
            readyMessage={`Configuração pronta: ${totalCopies} ${
              totalCopies === 1 ? 'etiqueta' : 'etiquetas'
            } em ${jobItems.length} ${jobItems.length === 1 ? 'produto' : 'produtos'}.`}
          />
        ) : null}

        {grid ? (
          <SheetPreview
            job={job}
            sheet={sheet}
            labelLayout={labelLayout}
            grid={grid}
            products={products}
          />
        ) : null}
      </>
    );
  }

  return (
    <ShellColumn
      title="Trabalho de impressão"
      label="Trabalho de impressão"
      className="border-r border-neutro-borda bg-neutro-branco"
      bodyClassName="px-5 pb-5 pt-4 flex flex-col gap-5"
      data-print-job-panel={isReady ? 'ready' : 'blocked'}
    >
      {renderBody()}
    </ShellColumn>
  );
}
