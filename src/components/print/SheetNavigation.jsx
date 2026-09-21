import { ChevronLeft, ChevronRight } from 'lucide-react';

import Button from '../ui/Button.jsx';

/**
 * Troca da folha desenhada. O indice comeca em zero e o texto comeca em 1.
 *
 * Os dois botoes levam nome proprio alem do texto visivel: lidos fora da
 * sequencia, "Anterior" e "Proxima" nao dizem anterior a que. O nome comeca
 * pelo mesmo texto que esta na tela, para que o comando falado continue
 * batendo com o que se ve.
 *
 * Em largura curta os dois botoes ficam lado a lado e a posicao desce para uma
 * linha propria: os tres lado a lado nao cabem nos 240 px uteis de uma tela de
 * 320 px, e encolher o texto do botao esconderia o que ele faz. A partir de
 * 640 px os tres voltam a mesma linha.
 */
export default function SheetNavigation({ sheetIndex, totalSheets, onChange }) {
  const isFirst = sheetIndex <= 0;
  const isLast = sheetIndex >= totalSheets - 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3" data-sheet-navigation="">
      <Button
        aria-label="Anterior: ir para a folha anterior"
        disabled={isFirst}
        onClick={() => onChange(sheetIndex - 1)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Anterior
      </Button>

      <p
        className="order-last w-full text-center text-sm tabular-nums text-slate-600 dark:text-slate-300 sm:order-none sm:w-auto sm:text-left"
        aria-live="polite"
      >
        <span data-sheet-position="">{`Folha ${sheetIndex + 1} de ${totalSheets}`}</span>
      </p>

      <Button
        aria-label="Próxima: ir para a próxima folha"
        disabled={isLast}
        onClick={() => onChange(sheetIndex + 1)}
      >
        Próxima
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
