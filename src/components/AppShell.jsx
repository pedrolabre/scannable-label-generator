import { cx } from '../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from './ui/focusClasses.js';

/**
 * Identificador do conteudo principal. Ele e o alvo do atalho que pula o
 * cabecalho e o ancora do proprio `main`, e existe como constante para que os
 * dois lados nao possam divergir.
 */
export const MAIN_CONTENT_ID = 'conteudo-principal';

/**
 * Contorno da aplicacao: cinco faixas em coluna, dentro da altura da janela.
 *
 *     cabecalho          64 px    marca e os gatilhos que nao pertencem a coluna nenhuma
 *     coluna esquerda   320 px    trabalho de impressao
 *     coluna central    elastica  listagem de produtos
 *     coluna direita    380 px    previa da etiqueta
 *     linha de estado    48 px    contagens e estado do banco
 *
 * A janela e o limite. Este contorno tem a altura dela e nao deixa nada
 * transbordar, e `html`, `body` e `#root` ja nao tem para onde rolar: a pagina
 * deixa de rolar por ausencia de espaco, e nao por escolha de estilo. O que
 * rola, daqui em diante, e um corpo nomeado dentro de uma `ShellColumn`.
 *
 * As tres colunas recebem medida fixa, menos a central. E o certo: a listagem e
 * a unica regiao cujo valor cresce com o tamanho da tela — a configuracao do
 * trabalho e a previa tem a largura de que precisam e nada ganham com mais.
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
 */
export default function AppShell({ header, left, center, right, status }) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-neutro-papel text-neutro-tinta">
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
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_380px]"
      >
        {left}
        {center}
        {right}
      </main>

      {status}
    </div>
  );
}
