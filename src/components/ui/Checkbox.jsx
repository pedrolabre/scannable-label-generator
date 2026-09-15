import { cx } from '../../lib/cx.js';

/**
 * Caixa de marcacao das listas, sem rotulo visivel ao lado.
 *
 * `label` e obrigatorio: e ele que nomeia a caixa para leitores de tela e
 * alimenta a dica do ponteiro, do mesmo jeito que no botao compacto de acao.
 *
 * A cor da marca vem de `accent-color`, que o proprio navegador aplica ao
 * controle nativo. Redesenhar a caixa por cima exigiria esconder o controle e
 * reconstruir foco, estado indeterminado e teclado a mao, sem ganho nenhum.
 */
export default function Checkbox({ label, className, ...rest }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      title={label}
      className={cx(
        'h-4 w-4 shrink-0 cursor-pointer rounded-[2px] accent-[#cf1026]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-[#cf1026] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...rest}
    />
  );
}
