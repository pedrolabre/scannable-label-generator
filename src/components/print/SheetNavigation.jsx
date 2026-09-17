import { ChevronLeft, ChevronRight } from 'lucide-react';

import Button from '../ui/Button.jsx';

/**
 * Troca da folha desenhada. O indice comeca em zero e o texto comeca em 1.
 */
export default function SheetNavigation({ sheetIndex, totalSheets, onChange }) {
  const isFirst = sheetIndex <= 0;
  const isLast = sheetIndex >= totalSheets - 1;

  return (
    <div className="flex items-center justify-between gap-3" data-sheet-navigation="">
      <Button disabled={isFirst} onClick={() => onChange(sheetIndex - 1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Anterior
      </Button>

      <p className="text-sm tabular-nums text-slate-600 dark:text-slate-300" aria-live="polite">
        <span data-sheet-position="">{`Folha ${sheetIndex + 1} de ${totalSheets}`}</span>
      </p>

      <Button disabled={isLast} onClick={() => onChange(sheetIndex + 1)}>
        Próxima
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
