import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { describeStorageError } from '../../storage/storageError.js';
import { formatCount } from '../import/importCounts.js';
import Button from '../ui/Button.jsx';
import ConfirmModal from '../ui/ConfirmModal.jsx';

/**
 * Apaga a base de referencia inteira, depois de uma confirmacao que diz
 * quantos codigos saem e que o catalogo fica como esta.
 *
 * Segue o zerar catalogo: a confirmacao que falha mantem o dialogo aberto com
 * o motivo, e confirmar de novo e a nova tentativa. A perda nao e definitiva
 * como a do catalogo — a base se refaz carregando um arquivo —, e o texto diz
 * isso.
 */
export default function ClearReferenceButton({ total, onClear }) {
  const [open, setOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setIsClearing(true);
    setError(null);

    try {
      await onClear();
      setOpen(false);
    } catch (failure) {
      setError(describeStorageError(failure));
    } finally {
      setIsClearing(false);
    }
  }

  function handleCancel() {
    setOpen(false);
    setError(null);
  }

  const codes = total === 1 ? '1 código' : `${formatCount(total)} códigos`;

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)} data-apagar-base="">
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Apagar a base
      </Button>

      {open ? (
        <ConfirmModal
          title="Apagar a base de referência"
          subtitle={`${codes} sairão deste navegador`}
          confirmLabel="Apagar a base"
          isConfirming={isClearing}
          error={error}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        >
          <p>
            A base de referência inteira, com {codes}, sai do armazenamento deste navegador, e a
            importação deixa de completar o NCM e o código de barras.
          </p>
          <p>O catálogo fica como está. A base volta carregando um arquivo de novo.</p>
        </ConfirmModal>
      ) : null}
    </>
  );
}
