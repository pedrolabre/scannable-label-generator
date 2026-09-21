import { cx } from '../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from './ui/focusClasses.js';

/**
 * Identificador do conteudo principal. Ele e o alvo do atalho que pula o
 * cabecalho e o ancora do proprio `main`, e existe como constante para que os
 * dois lados nao possam divergir.
 */
export const MAIN_CONTENT_ID = 'conteudo-principal';

/**
 * Estrutura da pagina: o atalho de pular, o cabecalho e o conteudo.
 *
 * O primeiro elemento focavel da pagina e um atalho que leva direto ao
 * conteudo. Ele fica fora da vista ate receber foco, e so quem navega por
 * teclado o encontra. Sem ele, chegar ao formulario a partir da barra do
 * navegador custa atravessar o cabecalho inteiro a cada recarregamento.
 *
 * O `main` recebe `tabIndex` negativo porque um destino de ancora que nao
 * aceita foco e ignorado por parte dos navegadores: o endereco muda e o foco
 * fica onde estava. Com ele, o atalho move o foco de verdade, e o valor
 * negativo mantem o elemento fora da ordem de tabulacao.
 */
export default function AppShell({ header, children }) {
  return (
    <div className="flex min-h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className={cx(
          'sr-only rounded-[3px] border border-[#cf1026] bg-white px-4 py-2',
          'text-sm font-semibold text-[#cf1026]',
          'focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50',
          FOCUS_OUTLINE,
          FOCUS_OUTLINE_COLORS.brand,
        )}
      >
        Pular para o conteúdo
      </a>

      {header}

      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6"
      >
        {children}
      </main>
    </div>
  );
}
