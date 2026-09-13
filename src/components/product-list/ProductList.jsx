import { useMemo, useState } from 'react';

import { compareProductsByName, searchProducts } from '../../domain/services/productSearch.js';

import Card from '../ui/Card.jsx';
import ConfirmModal from '../ui/ConfirmModal.jsx';

import ProductCards from './ProductCards.jsx';
import { EmptyCatalogStatus, LoadingStatus, NoMatchStatus } from './ProductListStatus.jsx';
import ProductSearchField from './ProductSearchField.jsx';
import ProductTable from './ProductTable.jsx';

function countHint(visible, total) {
  if (visible === total) {
    return `${total} ${total === 1 ? 'produto' : 'produtos'}`;
  }

  return `${visible} de ${total}`;
}

/**
 * Listagem dos produtos salvos no dispositivo: busca, tabela ou cartoes
 * conforme a largura, e as acoes de editar e remover por item.
 *
 * O termo de busca vive aqui porque so esta tela o consome. A edicao sobe para
 * quem montou a listagem, que decide onde o formulario aparece; a remocao passa
 * antes por uma confirmacao que mostra qual produto sai.
 */
export default function ProductList({ products, isLoading, onEdit, onRemove }) {
  const [query, setQuery] = useState('');
  const [productToRemove, setProductToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const visibleProducts = useMemo(
    () => [...searchProducts(products, query)].sort(compareProductsByName),
    [products, query],
  );

  async function handleConfirmRemoval() {
    setIsRemoving(true);

    try {
      await onRemove(productToRemove.id);
      setProductToRemove(null);
    } finally {
      setIsRemoving(false);
    }
  }

  function renderBody() {
    if (isLoading && products.length === 0) {
      return <LoadingStatus />;
    }

    if (products.length === 0) {
      return <EmptyCatalogStatus />;
    }

    if (visibleProducts.length === 0) {
      return <NoMatchStatus query={query} onClearSearch={() => setQuery('')} />;
    }

    return (
      <>
        <div className="hidden sm:block">
          <ProductTable
            products={visibleProducts}
            onEdit={onEdit}
            onRemove={setProductToRemove}
          />
        </div>

        <div className="sm:hidden">
          <ProductCards
            products={visibleProducts}
            onEdit={onEdit}
            onRemove={setProductToRemove}
          />
        </div>
      </>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="space-y-4 p-6">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">Produtos cadastrados</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tudo o que está salvo neste dispositivo, pronto para virar etiqueta.
          </p>
        </header>

        {products.length > 0 ? (
          <ProductSearchField
            value={query}
            onChange={setQuery}
            hint={countHint(visibleProducts.length, products.length)}
          />
        ) : null}
      </div>

      {renderBody()}

      {productToRemove ? (
        <ConfirmModal
          title="Remover produto"
          subtitle={productToRemove.displayName}
          confirmLabel="Remover produto"
          isConfirming={isRemoving}
          onConfirm={handleConfirmRemoval}
          onCancel={() => setProductToRemove(null)}
        >
          <p>
            O produto sai da lista e do armazenamento deste dispositivo, junto com o código e o
            preço cadastrados.
          </p>
          <p>Para usá-lo de novo depois, será preciso cadastrá-lo outra vez.</p>
        </ConfirmModal>
      ) : null}
    </Card>
  );
}
