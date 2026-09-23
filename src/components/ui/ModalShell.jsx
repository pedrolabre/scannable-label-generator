import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

import { cx } from '../../lib/cx.js';

import IconButton from './IconButton.jsx';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Nem todo ambiente calcula layout. No navegador, `getClientRects()` vazio e o
// sinal de que o elemento nao esta na tela — escondido por `hidden`, por um
// ancestral sem caixa, ou fora de qualquer fluxo. Num ambiente sem layout, o
// mesmo teste devolve vazio para tudo, e a lista de focaveis vira uma lista
// vazia: o cerco do foco existiria no codigo e nao valeria em teste nenhum.
//
// Entao a pergunta vem antes: este documento desenha? O corpo da pagina sempre
// tem caixa onde ha layout, e nunca tem onde nao ha. So quando ha e que a
// medida de cada elemento diz alguma coisa.
function documentHasLayout(element) {
  const body = element?.ownerDocument?.body;

  return Boolean(body) && body.getClientRects().length > 0;
}

function focusableElementsOf(container) {
  if (!container) {
    return [];
  }

  const candidates = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));

  if (!documentHasLayout(container)) {
    return candidates;
  }

  return candidates.filter((element) => element.getClientRects().length > 0);
}

/**
 * Estrutura compartilhada dos dialogos da aplicacao: cortina escura, painel de
 * canto reto, cabecalho fixo, corpo rolavel e rodape de acoes.
 *
 * Enquanto o dialogo esta aberto ele e o unico alvo do teclado: `Tab` circula
 * entre os controles do painel sem escapar para a tela atras, `Esc` fecha, e o
 * documento por baixo ja nao rola, porque nada na aplicacao rola alem dos
 * corpos nomeados. O foco entra no botao de fechar quando o dialogo aparece e
 * volta para o elemento que o abriu quando ele sai, de modo que quem navega por
 * teclado retoma de onde parou. O titulo nomeia o dialogo para leitores de
 * tela.
 *
 * `width` e a largura do painel em pixel, porque cada dialogo tem a sua e a
 * medida vem do desenho, nao de uma escala de tamanhos. O painel para em
 * `calc(100dvh - 96px)` e quem cresce e o corpo, pelo mesmo padrao das colunas.
 * Dialogo que precisaria de mais altura perde conteudo para o corpo rolavel,
 * nunca para a janela.
 *
 * Abaixo do ponto de corte a medida do desenho deixa de valer: todo dialogo
 * ocupa a janela, menos 16 px de cada lado, na largura e na altura. A regra
 * vence a medida pedida, e as de foco e fechamento continuam as mesmas.
 * `compact` e a excecao: a confirmacao curta, que nao e tarefa e sim uma
 * pergunta, continua do tamanho do proprio texto.
 *
 * `height` fixa a altura para o dialogo cujo conteudo nao define a propria —
 * a folha, que ocupa o espaco que houver. O teto continua valendo por cima
 * dela: em janela baixa, o painel encolhe ate o teto e nao passa dele.
 *
 * `scrollBody` em `false` entrega o corpo sem rolagem e sem recuo, para o
 * dialogo que ja tem a propria regiao rolavel. Sem essa saida, o corpo rolaria
 * por fora de uma regiao que rola por dentro — duas rolagens, uma dentro da
 * outra, que e justamente o que a tela inteira evita.
 *
 * `headerActions` fica no cabecalho, antes do botao de fechar: o controle que
 * governa o dialogo inteiro, e nao uma parte do corpo.
 *
 * `closeOnBackdrop` fica em `false` onde ha trabalho em andamento —
 * importacao e restauracao. Clique fora nao descarta um arquivo ja conferido.
 *
 * `footer` recebe os botoes de acao ja montados, para que cada dialogo decida o
 * proprio conjunto sem que esta estrutura precise conhece-lo.
 */
export default function ModalShell({
  title,
  subtitle,
  width = 560,
  height,
  closeOnBackdrop = true,
  compact = false,
  scrollBody = true,
  onClose,
  headerActions,
  footer,
  children,
}) {
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

  // O clique so fecha quando nasce na propria cortina: arrastar uma selecao de
  // dentro do painel e soltar fora nao deve descartar o dialogo.
  function handleOverlayMouseDown(event) {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutro-cortina p-4"
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ width, height, maxWidth: '100%' }}
        className={cx(
          'flex max-h-[calc(100dvh-96px)] flex-col rounded border',
          'border-neutro-borda bg-neutro-branco shadow-modal',
          compact
            ? null
            : 'max-lg:!h-[calc(100dvh-32px)] max-lg:!max-h-none max-lg:!w-[calc(100dvw-32px)]',
        )}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-neutro-borda px-recuo py-4 lg:py-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h2
              id={titleId}
              className="font-display text-xl font-bold leading-tight tracking-[-0.015em] text-neutro-tinta lg:text-lg"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="text-rotulo leading-snug text-neutro-tintaFraca">{subtitle}</p>
            ) : null}
          </div>

          <div className="flex flex-none items-center gap-3">
            {headerActions}

            <IconButton ref={closeButtonRef} label="Fechar" onClick={onClose}>
              <X className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
        </header>

        <div
          className={
            scrollBody
              ? 'min-h-0 flex-1 overflow-y-auto px-recuo py-4'
              : 'flex min-h-0 flex-1 overflow-hidden'
          }
        >
          {children}
        </div>

        {footer ? (
          <footer className="flex flex-none flex-col-reverse gap-2 border-t border-neutro-borda px-recuo py-3 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
