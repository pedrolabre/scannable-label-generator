import { useEffect, useState } from 'react';

import {
  clampSheetIndex,
  labelsOnSheet,
  paginateLabels,
} from '../../domain/services/sheetPagination.js';

import ScrollRegion from '../ui/ScrollRegion.jsx';

import SheetCanvas from './SheetCanvas.jsx';
import SheetNavigation from './SheetNavigation.jsx';
import SheetScalePicker, { DEFAULT_SHEET_SCALE } from './SheetScalePicker.jsx';
import {
  describeCapacity,
  describeSheetCount,
  distinctSystemCodes,
  resolveSheetSlots,
} from './sheetSlots.js';
import { useSheetSymbols } from './useSheetSymbols.js';

/**
 * Desenho da folha de impressao, uma folha por vez.
 *
 * Recebe o trabalho, a folha e a grade ja conferidos por quem montou o painel.
 * Desenha so a folha escolhida: a tiragem pode passar de milhares de etiquetas,
 * e o total de folhas sai de conta, e nao de desenho. Por isso nao ha teto de
 * desenho aqui, e o que este componente mostra nao limita o que o trabalho
 * contem.
 *
 * A folha escolhida e o tamanho do desenho sao ajustes de quem esta olhando, e
 * vivem aqui. A folha tambem nao encolhe em janela estreita: a medida em
 * milimetro e a do papel, entao o desenho rola na horizontal dentro do painel,
 * numa area com nome e alcancavel pelo teclado.
 */

function SheetPlaceholder({ state, children }) {
  return (
    <div
      data-sheet-state={state}
      className="flex items-center justify-center rounded-[3px] border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
    >
      <p>{children}</p>
    </div>
  );
}

export default function SheetPreview({ job, sheet, labelLayout, grid, products }) {
  const [requestedIndex, setRequestedIndex] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(DEFAULT_SHEET_SCALE);

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
  const symbols = useSheetSymbols(distinctSystemCodes(slots));

  const sheetCountMessage = describeSheetCount(pages, grid.perSheet);

  function renderBody() {
    if (grid.perSheet === 0) {
      return (
        <SheetPlaceholder state="no-capacity">Nenhuma etiqueta cabe nesta folha.</SheetPlaceholder>
      );
    }

    return (
      <>
        {sheetCountMessage ? (
          <p
            data-sheet-count={pages.totalSheets}
            className="rounded-[3px] border border-[#8a5a00] bg-[#fff8e6] p-3 text-sm text-[#8a5a00] dark:bg-[#33280f] dark:text-[#f4c95f]"
          >
            {sheetCountMessage}
          </p>
        ) : (
          <p data-sheet-count={pages.totalSheets} className="text-sm text-slate-600 dark:text-slate-300">
            {describeCapacity(pages, grid.perSheet)}
          </p>
        )}

        {pages.totalSheets > 1 ? (
          <SheetNavigation
            sheetIndex={sheetIndex}
            totalSheets={pages.totalSheets}
            onChange={(next) => setRequestedIndex(clampSheetIndex(next, pages.totalSheets))}
          />
        ) : null}

        <ScrollRegion
          label="Desenho da folha, rolagem horizontal"
          data-sheet-state="drawn"
          className="pb-1"
        >
          <SheetCanvas
            sheet={sheet}
            labelLayout={labelLayout}
            slots={slots}
            symbols={symbols}
            scaleFactor={scaleFactor}
          />
        </ScrollRegion>
      </>
    );
  }

  return (
    <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800" data-sheet-preview="">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <header className="space-y-1">
          <h3 className="text-sm font-semibold">Prévia da folha</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Posição das etiquetas com as margens e o espaçamento atuais. O tamanho em tela varia com
            o zoom e com o monitor.
          </p>
        </header>

        {grid.perSheet > 0 ? <SheetScalePicker value={scaleFactor} onChange={setScaleFactor} /> : null}
      </div>

      {renderBody()}
    </section>
  );
}
