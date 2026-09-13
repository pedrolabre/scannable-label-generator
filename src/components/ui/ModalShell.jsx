import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

import { cx } from '../../lib/cx.js';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Um elemento desabilitado no meio do caminho ou escondido por `hidden` nao
// recebe foco; `getClientRects()` vazio e o sinal de que ele nao esta na tela.
function focusableElementsOf(container) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0,
  );
}

/**
 * Estrutura compartilhada dos dialogos da aplicacao: sobreposicao escura,
 * painel de canto reto, cabecalho na cor de marca, corpo rolavel e rodape de
 * acoes.
 *
 * Enquanto o dialogo esta aberto ele e o unico alvo do teclado: `Tab` circula
 * entre os controles do painel sem escapar para a pagina atras, `Esc` fecha,
 * clique iniciado na sobreposicao fecha, e o documento por baixo para de rolar.
 * O foco entra no botao de fechar quando o dialogo aparece e volta para o
 * elemento que o abriu quando ele sai, de modo que quem navega por teclado
 * retoma de onde parou. O titulo nomeia o dialogo para leitores de tela.
 *
 * `footer` recebe os botoes de acao ja montados, para que cada dialogo decida o
 * proprio conjunto sem que esta estrutura precise conhece-lo.
 */
export default function ModalShell({ title, subtitle, onClose, footer, children }) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement;

    closeButtonRef.current?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    const { style } = document.body;
    const previousOverflow = style.overflow;

    style.overflow = 'hidden';

    return () => {
      style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const panel = panelRef.current;
      const focusable = focusableElementsOf(panel);

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // O foco pode estar fora do painel quando o usuario volta da barra do
      // navegador com `Tab`: nesse caso ele reentra pelo primeiro controle.
      if (!panel?.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // O clique so fecha quando nasce na propria sobreposicao: arrastar uma
  // selecao de dentro do painel e soltar fora nao deve descartar o dialogo.
  function handleOverlayMouseDown(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'flex max-h-full w-full max-w-lg flex-col rounded-none border shadow-none',
          'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
        )}
      >
        <header className="flex items-start gap-4 bg-[#cf1026] px-5 py-4 text-white">
          <div className="min-w-0 flex-1 space-y-0.5">
            <h2 id={titleId} className="text-base font-semibold leading-tight">
              {title}
            </h2>
            {subtitle ? <p className="text-sm leading-snug text-white/80">{subtitle}</p> : null}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
            className={cx(
              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-none',
              'border border-white/40 text-white transition-colors hover:bg-white/15',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              'focus-visible:outline-white',
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? (
          <footer
            className={cx(
              'flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end',
              'border-slate-200 dark:border-slate-800',
            )}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
