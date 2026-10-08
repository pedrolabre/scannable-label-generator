import { useId, useRef } from 'react';

import { cx } from '../../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from '../ui/focusClasses.js';

/**
 * Lados em que uma coluna pode virar gaveta. O nome e o da borda da janela onde
 * a coluna mora; a alca fica sempre na borda oposta, a que encosta na listagem.
 */
export const DRAWER_SIDES = Object.freeze({
  LEFT: 'esquerda',
  RIGHT: 'direita',
});

/**
 * Deslocamento minimo, em pixel de CSS, para que soltar a alca conte como
 * arraste e nao como clique. Abaixo disso a mao tremeu, e o gesto e um clique.
 */
export const DRAG_THRESHOLD = 16;

// A gaveta aberta deixa a grade e passa a ser medida pelo conteudo principal,
// que e o ancestral posicionado. As duas medidas moram no `tailwind.config.js`,
// junto da explicacao de onde vem cada numero.
const OPEN_SIDE_CLASSES = {
  [DRAWER_SIDES.LEFT]: 'lg:left-0 lg:right-gaveta-esquerda',
  [DRAWER_SIDES.RIGHT]: 'lg:right-0 lg:w-gaveta-direita',
};

const HANDLE_SIDE_CLASSES = {
  [DRAWER_SIDES.LEFT]: 'right-0 translate-x-1/2',
  [DRAWER_SIDES.RIGHT]: 'left-0 -translate-x-1/2',
};

const HANDLE_BASE = cx(
  'absolute top-1/2 z-20 hidden h-10 w-3 -translate-y-1/2 cursor-col-resize lg:flex',
  'items-center justify-center gap-[2px] border border-neutro-bordaForte bg-neutro-branco',
  'touch-none transition-colors hover:bg-neutro-superficie',
  FOCUS_OUTLINE,
  FOCUS_OUTLINE_COLORS.neutral,
);

/**
 * Coluna lateral que pode se alargar por cima da listagem, so na tela larga.
 *
 * Fechada, ela e a coluna de sempre, no lugar que a grade lhe da. Aberta, ela
 * sai da grade e passa a flutuar sobre a coluna central, sem que a grade mude:
 * o lugar dela continua reservado, e a listagem por baixo nao se mexe. O que
 * esta dentro e o mesmo elemento nos dois estados — nada e montado de novo, e o
 * que estava digitado ou com foco continua onde estava.
 *
 * A largura aberta e fixa, e nao livre. A da esquerda para antes da coluna
 * Codigo da tabela; a da direita, espelhada, cobre Acoes, Preco e Codigo e
 * para no fim do Produto.
 *
 * A alca e um botao de verdade: clique, `Enter` e espaco abrem e fecham. O
 * arraste e um atalho para o mesmo par de estados, e nao uma largura: soltar a
 * alca alem de `DRAG_THRESHOLD` na direcao da listagem abre, e na direcao da
 * borda fecha. Depois de um arraste, o clique que o navegador dispara ao soltar
 * e ignorado, para que o gesto nao conte duas vezes.
 *
 * Abaixo do ponto de corte a alca nao aparece e nenhuma classe de gaveta vale:
 * a tela estreita mostra uma coluna por vez e nao tem o que cobrir.
 *
 * Quem decide se esta aberta e quem fecha por `Esc` ou por clique fora e o
 * contorno, que conhece as duas gavetas e garante que so uma abra por vez.
 */
export default function ShellDrawer({ side, label, expanded, onExpandedChange, children }) {
  const panelId = useId();
  const dragStartRef = useRef(null);
  const suppressClickRef = useRef(false);

  // Direcao que abre: para a direita na gaveta da esquerda, e o contrario.
  const opensTowards = side === DRAWER_SIDES.LEFT ? 1 : -1;

  function handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    dragStartRef.current = event.clientX;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerUp(event) {
    const start = dragStartRef.current;
    dragStartRef.current = null;

    if (start === null) {
      return;
    }

    const delta = event.clientX - start;

    if (Math.abs(delta) < DRAG_THRESHOLD) {
      return;
    }

    suppressClickRef.current = true;
    onExpandedChange(Math.sign(delta) === opensTowards);
  }

  function handlePointerCancel() {
    dragStartRef.current = null;
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    onExpandedChange(!expanded);
  }

  const actionLabel = `${expanded ? 'Recolher' : 'Alargar'} ${label}`;

  return (
    <div
      id={panelId}
      data-gaveta={side}
      data-gaveta-aberta={expanded ? '' : undefined}
      className={cx(
        'flex min-h-0 min-w-0 flex-1 flex-col',
        expanded
          ? cx('relative lg:absolute lg:inset-y-0 lg:z-30 lg:shadow-gaveta', OPEN_SIDE_CLASSES[side])
          : 'relative',
      )}
    >
      {children}

      <button
        type="button"
        aria-label={actionLabel}
        title={actionLabel}
        aria-expanded={expanded}
        aria-controls={panelId}
        data-gaveta-alca=""
        className={cx(HANDLE_BASE, HANDLE_SIDE_CLASSES[side])}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
      >
        <span aria-hidden="true" className="h-4 w-px bg-neutro-tintaFraca" />
        <span aria-hidden="true" className="h-4 w-px bg-neutro-tintaFraca" />
        <span aria-hidden="true" className="h-4 w-px bg-neutro-tintaFraca" />
      </button>
    </div>
  );
}
