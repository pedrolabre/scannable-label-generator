import { cx } from '../../lib/cx.js';

import ProductTableRow from './ProductTableRow.jsx';

const HEAD_CELL_BASE = cx(
  'px-3 py-2 text-left text-[0.66rem] font-bold uppercase tracking-wide text-white',
);

// O cabecalho carrega a cor por grupo de coluna: a cor de marca nas colunas
// gerais e o tom de venda na coluna que mostra dinheiro.
const HEAD_GENERAL = 'bg-[#cf1026]';
const HEAD_PRICE = 'bg-[#23824a]';

/**
 * Tabela da listagem, usada a partir de `sm:`. As linhas nao alternam cor de
 * fundo: o unico realce e o do ponteiro sobre a linha, para que a tabela leia
 * como planilha parada ate alguem interagir com ela.
 */
export default function ProductTable({
  products,
  selectedProductId = null,
  onEdit,
  onPreview,
  onRemove,
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th scope="col" className={cx(HEAD_CELL_BASE, HEAD_GENERAL)}>
            Produto
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, HEAD_GENERAL)}>
            Código
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, HEAD_GENERAL)}>
            Cód. barras
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, HEAD_PRICE, 'text-right')}>
            Preço
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, HEAD_GENERAL)}>
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>

      <tbody>
        {products.map((product) => (
          <ProductTableRow
            key={product.id}
            product={product}
            isSelected={product.id === selectedProductId}
            onEdit={onEdit}
            onPreview={onPreview}
            onRemove={onRemove}
          />
        ))}
      </tbody>
    </table>
  );
}
