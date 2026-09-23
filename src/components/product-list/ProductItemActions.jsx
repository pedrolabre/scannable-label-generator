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
  align = 'end',
  className,
}) {
  return (
    <div
      className={cx(
        'flex items-center gap-1',
        align === 'start' ? 'justify-start' : 'justify-end',
        className,
      )}
    >
      <IconButton
        label={`Ver etiqueta de ${product.displayName}`}
        aria-pressed={isSelected}
        onClick={() => onPreview(product)}
        tone={isSelected ? 'selected' : 'plain'}
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
