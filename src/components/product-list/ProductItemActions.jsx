import { Pencil, Tag, Trash2 } from 'lucide-react';

import { cx } from '../../lib/cx.js';

import IconButton from '../ui/IconButton.jsx';

/**
 * Acoes que se repetem a cada produto, compartilhadas pela tabela e pelos
 * cartoes. O nome do produto entra no rotulo de cada botao para que a acao
 * continue identificavel quando lida fora do contexto da linha.
 *
 * A primeira acao abre a etiqueta do produto no painel de previa. Ela fica
 * marcada enquanto aquele produto e o desenhado, para que a linha diga qual dos
 * produtos esta na previa sem precisar de realce proprio.
 */
export default function ProductItemActions({
  product,
  isSelected = false,
  onPreview,
  onEdit,
  onRemove,
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <IconButton
        label={`Ver etiqueta de ${product.displayName}`}
        aria-pressed={isSelected}
        onClick={() => onPreview(product)}
        className={cx(
          isSelected && 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
        )}
      >
        <Tag className="h-4 w-4" aria-hidden="true" />
      </IconButton>

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
