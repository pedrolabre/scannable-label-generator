import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { describeStorageError } from '../../storage/storageError.js';

import Button from '../ui/Button.jsx';
import ConfirmModal from '../ui/ConfirmModal.jsx';

function describeTotal(total) {
  return total === 1 ? '1 produto' : `${total.toLocaleString('pt-BR')} produtos`;
}

/**
 * Apaga o catalogo inteiro, depois de uma confirmacao que diz quantos produtos
 * saem.
 *
 * Existe para recomecar do zero antes de uma importacao limpa, sem remover
 * produto a produto. O dialogo diz o total e avisa que a perda e definitiva
 * sem backup: o botao de confirmar repete o nome da acao, e nao um "OK".
 *
 * A confirmacao que falha mantem o dialogo aberto com o motivo, e confirmar de
 * novo e a nova tentativa, como na remocao de um produto.
 */
export default function ClearCatalogButton({ total, onClear, className }) {
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

  return (
    <>
      <Button
        type="button"
        variant="danger"
        className={className}
        onClick={() => setOpen(true)}
        data-clear-catalog=""
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Zerar catálogo
      </Button>

      {open ? (
        <ConfirmModal
          title="Zerar catálogo"
          subtitle={`${describeTotal(total)} sairão deste dispositivo`}
          confirmLabel="Zerar catálogo"
          isConfirming={isClearing}
          error={error}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        >
          <p data-clear-catalog-total={total}>
            Todos os {describeTotal(total)} do catálogo saem da lista e do armazenamento deste
            dispositivo.
          </p>
          <p>
            A perda é definitiva: sem um arquivo de backup, não há como trazer os produtos de
            volta. O nome da empresa e o parcelamento continuam guardados.
          </p>
        </ConfirmModal>
      ) : null}
    </>
  );
}
