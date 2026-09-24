import { useEffect, useState } from 'react';

import {
  clampSheetIndex,
  labelsOnSheet,
  paginateLabels,
} from '../../domain/services/sheetPagination.js';
import { useLabelHeader } from '../../store/useLabelSettingsStore.js';

import SheetCanvas from './SheetCanvas.jsx';
import SheetNavigation from './SheetNavigation.jsx';
import { DEFAULT_SHEET_SCALE } from './SheetScalePicker.jsx';
import {
  describeCapacity,
  describeGridShape,
  describeSheetCount,
  describeSheetMargins,
  resolveSheetSlots,
  sheetSymbolTexts,
} from './sheetSlots.js';
import { useSheetSymbols } from './useSheetSymbols.js';

/**
 * Miolo do dialogo da folha: a mesa com a folha desenhada e, ao lado, a ficha
 * que diz o que a folha contem. Abaixo do ponto de corte a ficha desce para
 * baixo da mesa, na largura inteira: ao lado, ela tomaria da mesa quase toda a
 * largura da janela.
 *
 * Recebe o trabalho, a folha e a grade ja conferidos por quem montou a tela.
 * Desenha so a folha escolhida: a tiragem pode passar de milhares de etiquetas,
 * e o total de folhas sai de conta, e nao de desenho. Por isso nao ha teto de
 * desenho aqui, e o que este componente mostra nao limita o que o trabalho
 * contem.
 *
 * A mesa e o unico lugar que rola dentro do dialogo, nos dois sentidos. A
 * medida em milimetro e a do papel, entao em tamanho real a folha passa da
 * janela, e quem rola e a mesa, nunca o dialogo nem a pagina. Pela metade, a
 * folha inteira cabe na altura do dialogo. A mesa tem nome e recebe foco, para
 * que o teclado tambem alcance a parte da folha que esta fora da vista.
 *
 * A folha escolhida e ajuste de quem esta olhando, e vive aqui. O tamanho do
 * desenho chega de fora, porque o seletor dele fica no cabecalho do dialogo.
 *
 * `actions` fica ao pe da ficha, no lugar em que o olho termina a leitura.
 */

function SheetPlaceholder({ state, children }) {
  return (
    <div
      data-sheet-state={state}
      className="flex items-center justify-center border border-dashed border-neutro-bordaForte px-6 py-10 text-center text-sm text-neutro-tintaFraca"
    >
      <p>{children}</p>
    </div>
  );
}

function FactRow({ label, children, last = false, ...rest }) {
  return (
    <div
      className={
        last
          ? 'flex justify-between gap-3 py-2 text-rotulo'
          : 'flex justify-between gap-3 border-b border-neutro-superficie py-2 text-rotulo'
      }
    >
      <dt className="text-neutro-tintaFraca">{label}</dt>
      <dd className="text-right font-medium text-neutro-tinta" {...rest}>
        {children}
      </dd>
    </div>
  );
}

export default function SheetPreview({
  job,
  sheet,
  labelLayout,
  grid,
  products,
  scaleFactor = DEFAULT_SHEET_SCALE,
  actions = null,
}) {
  const [requestedIndex, setRequestedIndex] = useState(0);

  const pages = paginateLabels(job.items, grid.perSheet);
  const sheetIndex = clampSheetIndex(requestedIndex, pages.totalSheets);

  // A folha escolhida acompanha o corte: se a selecao voltar a crescer, a tela
  // continua na folha que o operador estava vendo, e nao salta para a antiga.
  useEffect(() => {
    if (requestedIndex !== sheetIndex) {
      setRequestedIndex(sheetIndex);
    }
  }, [requestedIndex, sheetIndex]);

  const slots = resolveSheetSlots(
    labelsOnSheet(job.items, grid.perSheet, sheetIndex),
    products,
    grid,
  );
  const symbols = useSheetSymbols(sheetSymbolTexts(slots));
  const header = useLabelHeader();

  const hasCapacity = grid.perSheet > 0;
  const sheetCountMessage = hasCapacity ? describeSheetCount(pages, grid.perSheet) : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row" data-sheet-preview="">
      <div
        role="group"
        aria-label="Mesa da folha"
        tabIndex={0}
        data-sheet-table=""
        className="min-h-0 min-w-0 flex-1 overflow-auto bg-neutro-superficie p-4 lg:p-6 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marca-vermelho"
      >
        {hasCapacity ? (
          <div className="mx-auto w-max" data-sheet-state="drawn">
            <SheetCanvas
              sheet={sheet}
              labelLayout={labelLayout}
              slots={slots}
              symbols={symbols}
              header={header}
              scaleFactor={scaleFactor}
            />
          </div>
        ) : (
          <SheetPlaceholder state="no-capacity">Nenhuma etiqueta cabe nesta folha.</SheetPlaceholder>
        )}
      </div>

      <aside
        aria-label="Ficha da folha"
        className="flex w-full flex-none flex-col gap-3 border-t border-neutro-borda bg-neutro-branco px-recuo py-4 lg:w-[300px] lg:gap-4 lg:border-l lg:border-t-0"
      >
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-xs font-semibold uppercase tracking-[0.09em] text-neutro-tintaFraca">
            Folha
          </h3>

          <dl className="flex flex-col">
            <FactRow label="Papel">{sheet.name}</FactRow>
            <FactRow label="Grade" data-sheet-grid="">
              {describeGridShape(grid)}
            </FactRow>
            <FactRow label="Etiquetas nesta folha" data-sheet-labels={slots.length}>
              {slots.length}
            </FactRow>
            <FactRow label="Margem" last>
              {describeSheetMargins(sheet)}
            </FactRow>
          </dl>
        </div>

        {hasCapacity ? (
          sheetCountMessage ? (
            <p
              data-sheet-count={pages.totalSheets}
              className="border border-marca-amareloBorda bg-marca-amareloTenue p-3 text-xs leading-snug text-marca-amareloTexto"
            >
              {sheetCountMessage}
            </p>
          ) : (
            <p data-sheet-count={pages.totalSheets} className="text-xs leading-snug text-neutro-tintaMedia">
              {describeCapacity(pages, grid.perSheet)}
            </p>
          )
        ) : null}

        {pages.totalSheets > 1 ? (
          <SheetNavigation
            sheetIndex={sheetIndex}
            totalSheets={pages.totalSheets}
            onChange={(next) => setRequestedIndex(clampSheetIndex(next, pages.totalSheets))}
          />
        ) : null}

        {actions ? <div className="mt-auto">{actions}</div> : null}
      </aside>
    </div>
  );
}
