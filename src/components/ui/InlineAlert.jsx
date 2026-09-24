import { AlertTriangle } from 'lucide-react';

import { cx } from '../../lib/cx.js';

/**
 * Aviso de erro exibido junto da acao que o gerou, em vez de uma faixa no topo
 * da aplicacao: quem acabou de clicar le a resposta no mesmo lugar em que
 * clicou.
 *
 * O erro divide o vermelho com a marca e se distingue dela pelo peso: fundo
 * tenue, borda propria e texto proprio, nunca preenchimento cheio. Anuncia o
 * texto com `role="alert"` para quem usa leitor de tela.
 */
export default function InlineAlert({ className, children }) {
  return (
    <p
      role="alert"
      className={cx(
        'flex items-start gap-2 rounded border border-marca-vermelhoBorda',
        'bg-marca-vermelhoTenue p-3 text-sm text-marca-vermelhoTexto',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
