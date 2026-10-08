import { cx } from '../../lib/cx.js';

import ProductTableRow from './ProductTableRow.jsx';
import SelectAllForPrint from './SelectAllForPrint.jsx';

// A faixa de colunas e a unica parte da tabela que nao rola: ela gruda no topo
// do corpo da coluna, para que quem desce trezentos produtos continue sabendo o
// que cada coluna diz. `sticky` no proprio `th` e o que faz isso funcionar
// dentro de uma tabela — `thead` nao aceita posicionamento em todos os
// navegadores, e a celula aceita.
const HEAD_CELL_BASE = cx(
  'sticky top-0 z-10 bg-neutro-superficie px-2 py-2.5 text-left lg:py-2',
  'border-b border-neutro-borda text-[11px] font-semibold uppercase',
  'tracking-[0.07em] text-neutro-tintaFraca',
);

/**
 * Tabela da listagem, usada a partir de `sm:`. As linhas nao alternam cor de
 * fundo: o unico realce e o do ponteiro sobre a linha, para que a tabela leia
 * como planilha parada ate alguem interagir com ela.
 *
 * A primeira coluna marca o produto para a folha de etiquetas.
 *
 * A largura das colunas e fixa, menos a do produto, que fica com o que sobrar.
 * Com a largura decidida pelo conteudo, a soma dos codigos e do preco passava da
 * coluna central e a listagem rolava de lado. Fixada, a tabela nunca passa da
 * largura que recebe, e o nome longo e o que cede, com reticencias.
 *
 * Sao quatro colunas de dado alem da marcacao: produto, codigo, preco e acoes.
 * O codigo de barras nao tem coluna propria: ele desce para a linha muda do
 * produto, ao lado da categoria. Com coluna, ele tomava do nome a largura de que
 * o nome precisa para ser lido numa tela de 1366 px.
 *
 * As larguras de Codigo, Preco e Acoes na tela larga tambem medem as gavetas
 * das colunas laterais (`gaveta-esquerda` e `gaveta-direita` no
 * `tailwind.config.js`): a da esquerda para antes do Codigo, e a da direita
 * cobre as tres. Mudou uma, muda la tambem.
 */
export default function ProductTable({
  products,
  selectedProductId = null,
  printSelection,
  onTogglePrint,
  selectAll = null,
  onEdit,
  onPreview,
  onRemove,
}) {
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <thead>
        <tr>
          <th scope="col" className={cx(HEAD_CELL_BASE, 'w-[108px] whitespace-nowrap')}>
            {selectAll ? (
              <span className="flex items-center gap-1">
                <SelectAllForPrint state={selectAll.state} onChange={selectAll.onChange} />
                Imprimir
              </span>
            ) : (
              'Imprimir'
            )}
          </th>
          <th scope="col" className={HEAD_CELL_BASE}>
            Produto
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, 'w-[104px] lg:w-[96px]')}>
            Código
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, 'w-[128px] text-right lg:w-[112px]')}>
            Preço
          </th>
          <th scope="col" className={cx(HEAD_CELL_BASE, 'w-[168px] lg:w-[128px]')}>
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
