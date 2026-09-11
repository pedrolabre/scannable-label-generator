import { cx } from '../../lib/cx.js';

/**
 * Superficie padrao da interface. O peso visual vem da borda e da cor solida,
 * nunca de elevacao: nenhuma sombra, canto quase reto.
 *
 * `as` troca o elemento renderizado quando a semantica pedir outro (`article`,
 * `div`, `form`); o padrao e `section`.
 */
export default function Card({ as: Element = 'section', className, children, ...rest }) {
  return (
    <Element
      className={cx(
        'rounded-[3px] border border-slate-200 bg-white shadow-none',
        'dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
      {...rest}
    >
      {children}
    </Element>
  );
}
