import { cx } from '../../lib/cx.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';

import Checkbox from '../ui/Checkbox.jsx';

import ProductItemActions from './ProductItemActions.jsx';

// Marca de campo sem valor preenchido, para que a celula continue legivel como
// coluna em vez de abrir um buraco na linha.
const NO_VALUE = '-';

const CELL_BASE = 'border-b border-slate-200 px-3 py-2.5 align-middle dark:border-slate-800';

// Tom de venda do texto. O verde mais claro da paleta fica em 4,43 para 1 sobre
// o fundo branco, logo abaixo do minimo para texto; este e o tom vizinho, ja
// nomeado pelo padrao visual, e fecha em 5,42.
const PRICE_TEXT = 'text-[#0f7a3d] dark:text-[#4bd486]';

/**
 * Uma linha da tabela de produtos. O nome carrega a categoria numa segunda
 * linha muda, os dois codigos ficam em tom neutro e o preco leva o tom de venda
 * alinhado a direita.
 *
 * A caixa de marcacao da primeira celula decide se o produto entra na folha de
 * etiquetas. Ela e independente da acao de ver a etiqueta: uma responde "o que
 * vai ser impresso", a outra responde "qual estou olhando agora".
 */
export default function ProductTableRow({
  product,
  isSelected = false,
  isSelectedForPrint = false,
  onTogglePrint,
  onEdit,
  onPreview,
  onRemove,
}) {
  return (
    <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <td className={cx(CELL_BASE, 'w-px text-center')}>
        <Checkbox
          label={`Imprimir etiqueta de ${product.displayName}`}
          checked={isSelectedForPrint}
          onChange={() => onTogglePrint(product.id)}
        />
      </td>

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
          PRICE_TEXT,
        )}
      >
        {formatCentavosAsBRL(product.priceInCentavos)}
      </td>

      <td className={cx(CELL_BASE, 'w-px whitespace-nowrap')}>
        <ProductItemActions
          product={product}
          isSelected={isSelected}
          onEdit={onEdit}
          onPreview={onPreview}
          onRemove={onRemove}
        />
      </td>
    </tr>
  );
}
