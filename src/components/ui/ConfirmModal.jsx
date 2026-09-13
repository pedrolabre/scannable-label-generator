import { AlertTriangle } from 'lucide-react';

import Button from './Button.jsx';
import InlineAlert from './InlineAlert.jsx';
import ModalShell from './ModalShell.jsx';

/**
 * Dialogo de confirmacao de uma acao destrutiva. O icone de perigo ao lado da
 * mensagem e o rotulo explicito no botao de confirmacao dizem o que acontece
 * antes do clique, em vez de deixar a decisao para um "OK" generico.
 *
 * `error` mantem o dialogo aberto depois de uma confirmacao que falhou: o aviso
 * aparece acima do rodape, o botao de confirmar volta a ficar ativo e serve de
 * nova tentativa, e cancelar continua descartando a acao.
 */
export default function ConfirmModal({
  title,
  subtitle,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isConfirming = false,
  error = null,
  onConfirm,
  onCancel,
  children,
}) {
  return (
    <ModalShell
      title={title}
      subtitle={subtitle}
      onClose={onCancel}
      footer={
        <>
          <Button type="button" onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isConfirming}>
            {error ? 'Tentar de novo' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff1ea] text-[#b93a20] dark:bg-[#3b211b] dark:text-[#ffb8a7]"
            aria-hidden="true"
          >
            <AlertTriangle className="h-5 w-5" />
          </span>

          <div className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {children}
          </div>
        </div>

        {error ? <InlineAlert>{error}</InlineAlert> : null}
      </div>
    </ModalShell>
  );
}
