import { cx } from '../../lib/cx.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';

import Checkbox from '../ui/Checkbox.jsx';

import ProductItemActions from './ProductItemActions.jsx';

const CELL_BASE = 'border-b border-neutro-divisor px-2 py-2 align-middle lg:py-1.5';

// Celula de uma linha so. A largura da coluna e fixa, entao o texto que nao
// cabe termina em reticencias em vez de alargar a tabela.
const SINGLE_LINE = 'overflow-hidden text-ellipsis whitespace-nowrap';

/**
 * Uma linha da tabela de produtos. O nome carrega a categoria e o codigo de
 * barras numa segunda linha muda, o codigo do sistema fica em tom neutro e o preco fica em peso de destaque,
 * alinhado a direita. O verde e reservado a confirmacao, e preco nao e
 * confirmacao de nada.
 *
 * A linha do produto que esta na previa ganha fundo de marca e nome em peso
 * maior. Os dois juntos, e o botao da etiqueta ligado: a escolha nunca e dita
 * so pela cor.
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
    <tr
      data-em-previa={isSelected ? '' : undefined}
      className={cx(
        'transition-colors',
        isSelected ? 'bg-marca-vermelhoTenue' : 'hover:bg-neutro-superficie',
      )}
    >
      <td className={cx(CELL_BASE, 'w-px text-center')}>
        <Checkbox
          label={`Imprimir etiqueta de ${product.displayName}`}
          checked={isSelectedForPrint}
          onChange={() => onTogglePrint(product.id)}
        />
      </td>

      <td className={CELL_BASE}>
        <p
          className={cx('truncate text-neutro-tinta', isSelected ? 'font-bold' : 'font-semibold')}
          title={product.displayName}
        >
          {product.displayName}
        </p>
        {product.category || product.ean ? (
          <p className="truncate text-xs text-neutro-tintaFraca">
            {product.category}
            {product.category && product.ean ? ' · ' : null}
            {product.ean ? (
              <span className="tabular-nums" data-ean="">
                {product.ean}
              </span>
            ) : null}
          </p>
        ) : null}
      </td>

      <td className={cx(CELL_BASE, SINGLE_LINE, 'tabular-nums text-neutro-tintaMedia')}>
        {product.systemCode}
      </td>

      <td
        className={cx(
          CELL_BASE,
          SINGLE_LINE,
          'text-right font-semibold tabular-nums text-neutro-tintaMedia',
        )}
      >
        {formatCentavosAsBRL(product.priceInCentavos)}
      </td>

      <td className={cx(CELL_BASE, 'whitespace-nowrap')}>
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
