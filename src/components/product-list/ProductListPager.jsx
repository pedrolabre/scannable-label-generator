import { ChevronLeft, ChevronRight } from 'lucide-react';

import Button from '../ui/Button.jsx';

/**
 * Troca da pagina da listagem, na faixa fixa abaixo do corpo da coluna. Ela
 * fica parada enquanto a lista rola, entao a proxima pagina esta sempre a um
 * clique, sem descer ate o fim.
 *
 * O indicador diz a pagina e o trecho do resultado que esta na tela. O total
 * fica so na dica do campo de busca, que ja diz "N produtos" ou "X de Y": o
 * mesmo numero dito em dois lugares e um numero que pode se contradizer.
 *
 * Os dois botoes levam nome proprio alem do texto visivel, como na troca de
 * folha da previa: lidos fora da sequencia, "Anterior" e "Proxima" nao dizem
 * anterior a que.
 */
export default function ProductListPager({ pageIndex, totalPages, first, last, onChange }) {
  const isFirst = pageIndex <= 0;
  const isLast = pageIndex >= totalPages - 1;

  return (
    <nav
      aria-label="Páginas da listagem"
      className="flex items-center justify-between gap-3"
      data-list-pager=""
    >
      <Button
        aria-label="Anterior: ir para a página anterior"
        disabled={isFirst}
        onClick={() => onChange(pageIndex - 1)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        <span className="max-sm:sr-only">Anterior</span>
      </Button>

      <p
        className="min-w-0 truncate text-center text-sm tabular-nums text-neutro-tintaFraca"
        aria-live="polite"
      >
        <span data-list-position="">{`Página ${pageIndex + 1} de ${totalPages}`}</span>
        <span aria-hidden="true">{' · '}</span>
        <span data-list-range="">{`${first}–${last}`}</span>
      </p>

      <Button
        aria-label="Próxima: ir para a próxima página"
        disabled={isLast}
        onClick={() => onChange(pageIndex + 1)}
      >
        <span className="max-sm:sr-only">Próxima</span>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
