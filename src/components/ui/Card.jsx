import { cx } from '../../lib/cx.js';

/**
 * Superficie delimitada por borda, para o conjunto que precisa se destacar de
 * dentro de uma coluna ou de um dialogo — o resumo da selecao, a ficha da
 * folha, a area do desenho.
 *
 * O peso visual vem da borda e da cor solida, nunca de elevacao: nenhuma
 * sombra, canto reto. A sombra do produto e uma so, e e do painel do dialogo.
 *
 * Desde que os paineis passaram a ser coluna e dialogo, esta superficie deixou
 * de ser a moldura da tela: quem separa as regioes agora e a propria faixa do
 * shell. O que sobra para ela e o conjunto dentro da regiao.
 *
 * `as` troca o elemento renderizado quando a semantica pedir outro (`article`,
 * `div`, `form`); o padrao e `section`.
 */
export default function Card({ as: Element = 'section', className, children, ...rest }) {
  return (
    <Element
      className={cx('rounded border border-neutro-borda bg-neutro-papel shadow-none', className)}
      {...rest}
    >
      {children}
    </Element>
  );
}
