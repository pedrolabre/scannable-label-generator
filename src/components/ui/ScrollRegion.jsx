import { cx } from '../../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from './focusClasses.js';

/**
 * Area que rola na horizontal sem arrastar o corpo da pagina junto.
 *
 * Existe para as duas superficies que saem em milimetro real: a etiqueta e a
 * folha. Nenhuma das duas encolhe em janela estreita, porque o contrato visual
 * proibe reflow e o milimetro e medida de papel, nao de tela. O que sobra e
 * deslizar o desenho dentro do proprio painel.
 *
 * Uma area que rola precisa ser alcancavel por quem nao usa ponteiro: sem
 * `tabIndex`, o teclado nao chega ao conteudo que esta fora da vista, e a
 * rolagem existe so para o mouse. Por isso ela recebe foco, tem nome proprio e
 * acende o mesmo realce das demais primitivas.
 *
 * Os atributos de marcacao usados pelos testes chegam por `rest` e ficam neste
 * mesmo elemento, que e onde sempre estiveram.
 */
export default function ScrollRegion({ label, className, children, ...rest }) {
  return (
    <div
      role="group"
      aria-label={label}
      tabIndex={0}
      className={cx('overflow-x-auto', FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS.neutral, className)}
      {...rest}
    >
      {children}
    </div>
  );
}
