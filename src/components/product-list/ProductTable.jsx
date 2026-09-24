import { cx } from '../../lib/cx.js';

import ProductTableRow from './ProductTableRow.jsx';

// A faixa de colunas e a unica parte da tabela que nao rola: ela gruda no topo
// do corpo da coluna, para que quem desce trezentos produtos continue sabendo o
// que cada coluna diz. `sticky` no proprio `th` e o que faz isso funcionar
// dentro de uma tabela — `thead` nao aceita posicionamento em todos os
// navegadores, e a celula aceita.
const HEAD_CELL_BASE = cx(
  'sticky top-0 z-10 bg-neutro-superficie px-2 py-2.5 text-left',
  'border-b border-neutro-borda text-[11px] font-semibold uppercase',
  'tracking-[0.07em] text-neutro-tintaFraca',
);

/**
 * Tabela da listagem, usada a partir de `sm:`. As linhas nao alternam cor de
 * fundo: o unico realce e o do ponteiro sobre a linha, para que a tabela leia
 * como planilha parada ate alguem interagir com ela.
 *
 * A primeira coluna marca o produto para a folha de etiquetas. Ela nao tem
 * marcar-todos: sobre uma lista filtrada pela busca, "todos" significaria ora o
 * catalogo inteiro ora so o que esta visivel, e as duas leituras sao defensaveis.
 *
 * A largura das colunas e fixa, menos a do produto, que fica com o que sobrar.
 * Com a largura decidida pelo conteudo, a soma dos codigos e do preco passava da
 * coluna central e a listagem rolava de lado. Fixada, a tabela nunca passa da
 * largura que recebe, e o nome longo e o que cede, com reticencias.
 */
export default function ProductTable({
  products,
  selectedProductId = null,
  printSelection,
  onTogglePrint,
  onEdit,
  onPreview,
  onRemove,
}) {
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <thead>
        <tr>
          <th scope="col" className={cx(HEAD_CELL_BASE, 'w-[80px] whitespace-nowrap')}>
            Imprimir
          </th>
          <th scope="col" className={HEAD_CELL_BASE}>
            Produto
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, 'w-[104px]')}>
            Código
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, 'w-[140px]')}>
            Cód. barras
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, 'w-[132px] text-right')}>
            Preço
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, 'w-[120px]')}>
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
            isSelectedForPrint={printSelection.has(product.id)}
            onTogglePrint={onTogglePrint}
            onEdit={onEdit}
            onPreview={onPreview}
            onRemove={onRemove}
          />
        ))}
      </tbody>
    </table>
  );
}
