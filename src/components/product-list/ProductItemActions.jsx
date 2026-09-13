import { Pencil, Trash2 } from 'lucide-react';

import IconButton from '../ui/IconButton.jsx';

/**
 * Acoes que se repetem a cada produto, compartilhadas pela tabela e pelos
 * cartoes. O nome do produto entra no rotulo de cada botao para que a acao
 * continue identificavel quando lida fora do contexto da linha.
 */
export default function ProductItemActions({ product, onEdit, onRemove }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <IconButton label={`Editar ${product.displayName}`} onClick={() => onEdit(product)}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </IconButton>

      <IconButton
        tone="danger"
        label={`Remover ${product.displayName}`}
        onClick={() => onRemove(product)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </IconButton>
    </div>
  );
}
