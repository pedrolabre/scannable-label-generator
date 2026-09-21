import { cx } from '../../lib/cx.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';

import Checkbox from '../ui/Checkbox.jsx';

import ProductItemActions from './ProductItemActions.jsx';

// Mesmo tom de venda da linha da tabela, pelo mesmo motivo de contraste.
const PRICE_TEXT = 'text-[#0f7a3d] dark:text-[#4bd486]';

/**
 * Superficie da listagem abaixo de `sm:`, onde as cinco colunas da tabela nao
 * cabem lado a lado. Cada produto vira um bloco com o nome em destaque, os
 * codigos empilhados e o preco alinhado com as acoes.
 *
 * A caixa de marcacao abre o cartao, no mesmo lugar em que abre a linha da
 * tabela: e a primeira decisao sobre o produto, e nao uma acao entre as outras.
 */
export default function ProductCards({
  products,
  selectedProductId = null,
  printSelection,
  onTogglePrint,
  onEdit,
  onPreview,
  onRemove,
}) {
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {products.map((product) => (
        <li key={product.id} className="flex items-start gap-3 px-4 py-3">
          <Checkbox
            label={`Imprimir etiqueta de ${product.displayName}`}
            checked={printSelection.has(product.id)}
            onChange={() => onTogglePrint(product.id)}
            className="mt-1"
          />

          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
              {product.displayName}
            </p>

            {product.category ? (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {product.category}
              </p>
            ) : null}

            <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex gap-1.5">
                <dt>Código</dt>
                <dd className="tabular-nums text-slate-700 dark:text-slate-200">
                  {product.systemCode}
                </dd>
              </div>

              {product.ean ? (
                <div className="flex gap-1.5">
                  <dt>Cód. barras</dt>
                  <dd className="tabular-nums text-slate-700 dark:text-slate-200">{product.ean}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <p className={cx('font-semibold tabular-nums', PRICE_TEXT)}>
              {formatCentavosAsBRL(product.priceInCentavos)}
            </p>

            <ProductItemActions
              product={product}
              isSelected={product.id === selectedProductId}
              onEdit={onEdit}
              onPreview={onPreview}
              onRemove={onRemove}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
