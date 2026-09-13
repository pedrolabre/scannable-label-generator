import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

import { cx } from '../../lib/cx.js';

/**
 * Estrutura compartilhada dos dialogos da aplicacao: sobreposicao escura,
 * painel de canto reto, cabecalho na cor de marca, corpo rolavel e rodape de
 * acoes.
 *
 * O dialogo fecha com `Esc` e com clique fora do painel, e o foco vai para o
 * botao de fechar assim que ele aparece. O titulo nomeia o dialogo para
 * leitores de tela.
 *
 * `footer` recebe os botoes de acao ja montados, para que cada dialogo decida o
 * proprio conjunto sem que esta estrutura precise conhece-lo.
 */
export default function ModalShell({ title, subtitle, onClose, footer, children }) {
  const closeButtonRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
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
