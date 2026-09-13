import { AlertTriangle } from 'lucide-react';

import { cx } from '../../lib/cx.js';

/**
 * Aviso de erro exibido junto da acao que o gerou, em vez de uma faixa no topo
 * da aplicacao: quem acabou de clicar le a resposta no mesmo lugar em que
 * clicou.
 *
 * Usa os tokens de perigo suave, os mesmos da variante `danger` do botao, e
 * anuncia o texto com `role="alert"` para quem usa leitor de tela.
 */
export default function InlineAlert({ className, children }) {
  return (
    <p
      role="alert"
      className={cx(
        'flex items-start gap-2 rounded-[3px] border border-[#b93a20] bg-[#fff1ea] p-3',
        'text-sm text-[#b93a20] dark:bg-[#3b211b] dark:text-[#ffb8a7]',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
