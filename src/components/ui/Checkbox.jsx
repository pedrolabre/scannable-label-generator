import { cx } from '../../lib/cx.js';

import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS, MINIMUM_TARGET_CLASSES } from './focusClasses.js';

/**
 * Caixa de marcacao das listas, sem rotulo visivel ao lado.
 *
 * `label` e obrigatorio: e ele que nomeia a caixa para leitores de tela e
 * alimenta a dica do ponteiro, do mesmo jeito que no botao compacto de acao.
 *
 * A cor da marca vem de `accent-color`, que o proprio navegador aplica ao
 * controle nativo. Redesenhar a caixa por cima exigiria esconder o controle e
 * reconstruir foco, estado indeterminado e teclado a mao, sem ganho nenhum.
 *
 * O controle e desenhado com dezesseis pixels de lado, que e o tamanho certo
 * ao lado de um texto pequeno, mas dezesseis e menos que o minimo aceitavel
 * para um alvo de ponteiro — e esta e a primeira decisao de cada linha da
 * listagem, a que mais recebe toque em tela pequena. Por isso o controle vem
 * dentro de um rotulo de vinte e quatro pixels: a area que responde ao clique
 * e ao toque cresce, e o desenho continua o mesmo. O rotulo nao tem texto
 * proprio, entao nao acrescenta nome nenhum ao que `label` ja diz.
 *
 * `className` cai no rotulo, e nao no controle: o que quem usa ajusta e a
 * posicao do conjunto dentro da linha.
 */
export default function Checkbox({ label, className, ...rest }) {
  return (
    <label
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center',
        MINIMUM_TARGET_CLASSES,
        className,
      )}
    >
      <input
        type="checkbox"
        aria-label={label}
        title={label}
        className={cx(
          'h-4 w-4 shrink-0 cursor-pointer rounded-[2px] accent-[#cf1026]',
          FOCUS_OUTLINE,
          FOCUS_OUTLINE_COLORS.brand,
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
        {...rest}
      />
    </label>
  );
}
