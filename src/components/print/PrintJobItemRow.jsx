import { X } from 'lucide-react';

import { formatCentavosAsBRL } from '../../lib/currency.js';

import Field, { TextInput } from '../ui/Field.jsx';
import IconButton from '../ui/IconButton.jsx';

/**
 * Uma linha da selecao de impressao: o produto marcado, quantas etiquetas ele
 * rende e a saida da selecao.
 *
 * O aviso de simbolo recusado aparece aqui, e nao na listagem. A listagem nao
 * produz etiqueta, entao marcar linha la significaria perguntar por produto algo
 * que so interessa a quem vai imprimir. O aviso tambem nao impede a marcacao:
 * codigo que nao codifica nunca foi recusa de produto, e esconder o produto da
 * selecao esconderia o diagnostico de quem precisa dele.
 */
export default function PrintJobItemRow({
  product,
  copies,
  copiesError = null,
  hasSymbol = true,
  onCopiesChange,
  onRemove,
}) {
  return (
    <li
      data-print-item={product.id}
      data-symbol-support={hasSymbol ? 'ok' : 'unsupported'}
      className="flex items-start gap-3 border-b border-slate-200 py-3 last:border-b-0 dark:border-slate-800"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
          {product.displayName}
        </p>

        <p className="flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">{product.systemCode}</span>
          <span className="tabular-nums text-[#0f8a45] dark:text-[#4bd486]">
            {formatCentavosAsBRL(product.priceInCentavos)}
          </span>
        </p>

        {hasSymbol ? null : (
          <p className="text-xs text-[#8a5a00] dark:text-[#f4c95f]">
            Sem símbolo: o código não cabe na simbologia. A etiqueta sai com o restante do conteúdo.
          </p>
        )}
      </div>

      <div className="w-24 shrink-0">
        <Field id={`copias-${product.id}`} label="Cópias" error={copiesError}>
          {(controlProps) => (
            <TextInput
              {...controlProps}
              inputMode="numeric"
              autoComplete="off"
              value={copies}
              onChange={(event) => onCopiesChange(product.id, event.target.value)}
            />
          )}
        </Field>
      </div>

      <IconButton
        label={`Retirar ${product.displayName} da seleção`}
        className="mt-5"
        onClick={() => onRemove(product.id)}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </IconButton>
    </li>
  );
}
