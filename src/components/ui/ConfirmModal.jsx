import { AlertTriangle } from 'lucide-react';

import Button from './Button.jsx';
import ModalShell from './ModalShell.jsx';

/**
 * Dialogo de confirmacao de uma acao destrutiva. O icone de perigo ao lado da
 * mensagem e o rotulo explicito no botao de confirmacao dizem o que acontece
 * antes do clique, em vez de deixar a decisao para um "OK" generico.
 */
export default function ConfirmModal({
  title,
  subtitle,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isConfirming = false,
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
            {confirmLabel}
          </Button>
        </>
      }
    >
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
    </ModalShell>
  );
}
