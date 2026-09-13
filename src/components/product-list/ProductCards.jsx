import { formatCentavosAsBRL } from '../../lib/currency.js';

import ProductItemActions from './ProductItemActions.jsx';

/**
 * Superficie da listagem abaixo de `sm:`, onde as cinco colunas da tabela nao
 * cabem lado a lado. Cada produto vira um bloco com o nome em destaque, os
 * codigos empilhados e o preco alinhado com as acoes.
 */
export default function ProductCards({ products, onEdit, onRemove }) {
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {products.map((product) => (
        <li key={product.id} className="flex items-start gap-3 px-4 py-3">
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
            <p className="font-semibold tabular-nums text-[#0f8a45] dark:text-[#4bd486]">
              {formatCentavosAsBRL(product.priceInCentavos)}
            </p>

            <ProductItemActions product={product} onEdit={onEdit} onRemove={onRemove} />
          </div>
        </li>
      ))}
    </ul>
  );
}
