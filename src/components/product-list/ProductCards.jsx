import { cx } from '../../lib/cx.js';
import { formatCentavosAsBRL } from '../../lib/currency.js';

import Checkbox from '../ui/Checkbox.jsx';

import ProductItemActions from './ProductItemActions.jsx';

// O mesmo tom da linha da tabela. O verde e reservado a confirmacao, e preco
// nao e confirmacao de nada: as duas vistas da listagem dizem o preco igual.
const PRICE_TEXT = 'text-neutro-tintaMedia';

/**
 * Superficie da listagem abaixo de `sm:`, onde as colunas da tabela nao cabem
 * lado a lado. Cada produto vira um cartao com o nome em destaque e o preco na
 * mesma linha, os codigos embaixo e as acoes por ultimo, na largura do texto:
 * com as acoes ao lado do nome, sobrava ao nome um terco da tela.
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
    <ul className="divide-y divide-neutro-divisor">
      {products.map((product) => (
        <li key={product.id} className="flex items-start gap-3 px-4 py-3">
          <Checkbox
            label={`Imprimir etiqueta de ${product.displayName}`}
            checked={printSelection.has(product.id)}
            onChange={() => onTogglePrint(product.id)}
            className="mt-1"
          />

          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-semibold text-neutro-tinta">{product.displayName}</p>

            {product.category ? (
              <p className="truncate text-xs text-neutro-tintaFraca">{product.category}</p>
            ) : null}

            <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-neutro-tintaFraca">
              <div className="flex gap-1.5">
                <dt className="whitespace-nowrap">Código</dt>
                <dd className="tabular-nums text-neutro-tintaMedia">{product.systemCode}</dd>
              </div>

              {product.ean ? (
                <div className="flex gap-1.5">
                  <dt className="whitespace-nowrap">Cód. barras</dt>
                  <dd className="tabular-nums text-neutro-tintaMedia">{product.ean}</dd>
                </div>
              ) : null}
            </dl>

            <ProductItemActions
              product={product}
              isSelected={product.id === selectedProductId}
              onEdit={onEdit}
              onPreview={onPreview}
              onRemove={onRemove}
              align="start"
              className="pt-2"
            />
          </div>

          <p className={cx('shrink-0 font-semibold tabular-nums', PRICE_TEXT)}>
            {formatCentavosAsBRL(product.priceInCentavos)}
          </p>
        </li>
      ))}
    </ul>
  );
}
