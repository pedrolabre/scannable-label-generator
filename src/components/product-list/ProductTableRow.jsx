import { cx } from '../../lib/cx.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';

import ProductItemActions from './ProductItemActions.jsx';

// Marca de campo sem valor preenchido, para que a celula continue legivel como
// coluna em vez de abrir um buraco na linha.
const NO_VALUE = '-';

const CELL_BASE = 'border-b border-slate-200 px-3 py-2.5 align-middle dark:border-slate-800';

/**
 * Uma linha da tabela de produtos. O nome carrega a categoria numa segunda
 * linha muda, os dois codigos ficam em tom neutro e o preco leva o tom de venda
 * alinhado a direita.
 */
export default function ProductTableRow({ product, onEdit, onRemove }) {
  return (
    <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <td className={cx(CELL_BASE, 'max-w-[15rem]')}>
        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
          {product.displayName}
        </p>
        {product.category ? (
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{product.category}</p>
        ) : null}
      </td>

      <td className={cx(CELL_BASE, 'whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300')}>
        {product.systemCode}
      </td>

      <td className={cx(CELL_BASE, 'whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400')}>
        {product.ean ?? NO_VALUE}
      </td>

      <td
        className={cx(
          CELL_BASE,
          'whitespace-nowrap text-right font-semibold tabular-nums',
          'text-[#0f8a45] dark:text-[#4bd486]',
        )}
      >
        {formatCentavosAsBRL(product.priceInCentavos)}
      </td>

      <td className={cx(CELL_BASE, 'w-px whitespace-nowrap')}>
        <ProductItemActions product={product} onEdit={onEdit} onRemove={onRemove} />
      </td>
    </tr>
  );
}
