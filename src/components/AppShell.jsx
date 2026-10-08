import { useCallback, useEffect, useRef, useState } from 'react';

import { cx } from '../lib/cx.js';

import ShellDrawer, { DRAWER_SIDES } from './layout/ShellDrawer.jsx';
import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from './ui/focusClasses.js';

/**
 * Identificador do conteudo principal. Ele e o alvo do atalho que pula o
 * cabecalho e o ancora do proprio `main`, e existe como constante para que os
 * dois lados nao possam divergir.
 */
export const MAIN_CONTENT_ID = 'conteudo-principal';

/**
 * Vistas da tela estreita, na ordem em que aparecem na barra. Cada coluna da
 * tela larga vira uma vista, e so uma aparece por vez.
 */
export const SHELL_VIEWS = Object.freeze({
  PRINT: 'impressao',
  PRODUCTS: 'produtos',
  PREVIEW: 'previa',
});

/**
 * Contorno da aplicacao: cinco faixas em coluna, dentro da altura da janela.
 *
 *     cabecalho          48 px    marca e os gatilhos que nao pertencem a coluna nenhuma
 *     coluna esquerda   240 px    trabalho de impressao
 *     coluna central    elastica  listagem de produtos
 *     coluna direita    288 px    previa da etiqueta
 *     linha de estado    36 px    contagens
 *
 * As medidas sao as da tela larga, a partir do ponto de corte. Abaixo dele as
 * tres colunas nao cabem com a listagem legivel, e o contorno troca de forma
 * uma vez so: uma coluna por vez, escolhida pela barra de vistas do cabecalho.
 * Nao ha passo intermediario de duas colunas.
 *
 * A janela e o limite, nas duas formas. Este contorno tem a altura dela e nao
 * deixa nada transbordar, e `html`, `body` e `#root` ja nao tem para onde
 * rolar: a pagina deixa de rolar por ausencia de espaco, e nao por escolha de
 * estilo. O que rola e um corpo nomeado dentro de uma `ShellColumn` — tres na
 * tela larga, um na estreita.
 *
 * Cada coluna chega dentro de uma vista, que e so o lugar dela na grade. A
 * vista que nao e a ativa sai da tela estreita por inteiro, e nao fica atras
 * da outra: o que nao se ve tambem nao recebe foco nem e lido. Na tela larga
 * as tres aparecem sempre, e a vista ativa nao muda nada.
 *
 * O primeiro elemento focavel da tela e um atalho que leva direto ao conteudo.
 * Ele fica fora da vista ate receber foco, e so quem navega por teclado o
 * encontra. Sem ele, chegar a listagem a partir da barra do navegador custa
 * atravessar o cabecalho inteiro a cada recarregamento.
 *
 * O `main` recebe `tabIndex` negativo porque um destino de ancora que nao
 * aceita foco e ignorado por parte dos navegadores: o endereco muda e o foco
 * fica onde estava. Com ele, o atalho move o foco de verdade, e o valor
 * negativo mantem o elemento fora da ordem de tabulacao.
 *
 * As tres colunas chegam por posicao, e nao como filhos soltos: este contorno
 * decide onde cada uma vive e com que largura, e nao sabe nada do que ha dentro
 * delas.
 *
 * Na tela larga, as duas laterais sao gavetas: cada uma tem uma alca na borda
 * que encosta na listagem e pode se alargar por cima dela, sem mexer na grade
 * (`ShellDrawer`). O estado das duas mora aqui, num valor so, e por isso so uma
 * abre por vez — abrir a outra fecha a primeira. Aberta, ela fecha pela propria
 * alca, por `Esc` ou por um toque no conteudo principal fora dela. O valor e de
 * tela e morre no recarregamento.
 *
 * O `Esc` e ouvido no documento, porque o clique num texto da gaveta deixa o
 * foco no `body`. A tecla so vale quando parte do conteudo principal ou do
 * `body`: um dialogo aberto por cima trata o proprio `Esc`, e fechar o dialogo
 * nao deve recolher a gaveta que estava atras dele.
 */
export default function AppShell({
  header,
  left,
  center,
  right,
  status,
  activeView = SHELL_VIEWS.PRODUCTS,
}) {
  const mainRef = useRef(null);
  const [expandedSide, setExpandedSide] = useState(null);

  const setSideExpanded = useCallback((side, expanded) => {
    setExpandedSide((current) => {
      if (expanded) {
        return side;
      }

      return current === side ? null : current;
    });
  }, []);

  useEffect(() => {
    if (expandedSide === null) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') {
        return;
      }

      const target = event.target;
      const fromShell =
        target === document.body || (target instanceof Node && mainRef.current?.contains(target));

      if (fromShell) {
        setExpandedSide(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expandedSide]);

  // O toque fora fecha ja no `pointerdown`, e o clique segue o seu caminho: o
  // botao da listagem que estava a vista continua respondendo no mesmo gesto.
  function handlePointerDown(event) {
    if (expandedSide === null) {
      return;
    }

    const openDrawer = mainRef.current?.querySelector('[data-gaveta-aberta]');

    if (openDrawer && !openDrawer.contains(event.target)) {
      setExpandedSide(null);
    }
  }

  const columns = [
    [SHELL_VIEWS.PRINT, left, DRAWER_SIDES.LEFT, 'trabalho de impressão'],
    [SHELL_VIEWS.PRODUCTS, center, null, null],
    [SHELL_VIEWS.PREVIEW, right, DRAWER_SIDES.RIGHT, 'prévia da etiqueta'],
  ];

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-neutro-papel text-neutro-tinta">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className={cx(
          'sr-only rounded border border-marca-vermelho bg-neutro-branco px-4 py-2',
          'text-sm font-semibold text-marca-vermelho',
          'focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50',
          FOCUS_OUTLINE,
          FOCUS_OUTLINE_COLORS.brand,
        )}
      >
        Pular para o conteúdo
      </a>

      {header}

      <main
        ref={mainRef}
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        className="grid min-h-0 min-w-0 flex-1 grid-cols-1 lg:relative lg:grid-cols-janela"
      >
        {columns.map(([view, column, drawerSide, drawerLabel]) => (
          <div
            key={view}
            data-vista={view}
            data-vista-ativa={view === activeView ? '' : undefined}
            className={cx(
              'min-h-0 min-w-0 flex-col lg:flex',
              view === activeView ? 'flex' : 'hidden',
            )}
          >
            {drawerSide ? (
              <ShellDrawer
                side={drawerSide}
                label={drawerLabel}
                expanded={expandedSide === drawerSide}
                onExpandedChange={(expanded) => setSideExpanded(drawerSide, expanded)}
              >
                {column}
              </ShellDrawer>
            ) : (
              column
            )}
          </div>
        ))}
      </main>

      {status}
    </div>
  );
}
