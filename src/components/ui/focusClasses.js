import { cx } from '../../lib/cx.js';

/**
 * Realce de foco compartilhado por todas as primitivas interativas.
 *
 * A regra e uma so e mora aqui: contorno de dois pixels, deslocado do proprio
 * controle, aceso apenas quando o navegador entende que o foco precisa ser
 * visto. Repetir a mesma cadeia em cada componente foi o que deixou o
 * projeto com cinco copias que podiam divergir em silencio; um arquivo `.css`
 * avulso esta descartado pelo padrao visual, entao a forma certa e a
 * constante compartilhada.
 *
 * A cor acompanha o papel do controle, e nao o componente: marca na acao
 * principal, neutro nas acoes de apoio, perigo no que remove dados e branco
 * sobre a faixa de marca do cabecalho dos dialogos.
 */
export const FOCUS_OUTLINE = cx(
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
);

export const FOCUS_OUTLINE_COLORS = Object.freeze({
  brand: 'focus-visible:outline-[#cf1026]',
  neutral: 'focus-visible:outline-slate-400',
  danger: 'focus-visible:outline-[#b93a20]',
  inverse: 'focus-visible:outline-white',
});

/**
 * Mesma regra para o controle escondido so visualmente, cujo realce precisa
 * aparecer no elemento vizinho em vez de nele proprio. E o caso da escolha
 * unica, em que o radio real fica fora da tela e quem se pinta e o rotulo.
 */
export const PEER_FOCUS_OUTLINE = cx(
  'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
);

export const PEER_FOCUS_OUTLINE_COLORS = Object.freeze({
  brand: 'peer-focus-visible:outline-[#cf1026]',
  neutral: 'peer-focus-visible:outline-slate-400',
});

/**
 * Menor lado aceitavel de um alvo de ponteiro, em pixel de CSS. O numero vem
 * do criterio de tamanho de alvo e nao do desenho: a caixa de marcacao
 * continua sendo desenhada com 16, e o que cresce para 24 e a area que
 * responde ao clique e ao toque.
 */
export const MINIMUM_TARGET_CLASSES = 'h-6 w-6';
