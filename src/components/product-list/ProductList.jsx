import { useMemo, useState } from 'react';

import { compareProductsByName, searchProducts } from '../../domain/services/productSearch.js';
import { describeStorageError } from '../../storage/storageError.js';

import ShellColumn from '../layout/ShellColumn.jsx';
import ConfirmModal from '../ui/ConfirmModal.jsx';

import ProductCards from './ProductCards.jsx';
import {
  EmptyCatalogStatus,
  LoadFailureStatus,
  LoadingStatus,
  NoMatchStatus,
} from './ProductListStatus.jsx';
import ProductSearchField from './ProductSearchField.jsx';
import ProductTable from './ProductTable.jsx';

// Os avisos de estado nao encostam na borda da coluna como a tabela encosta: a
// tabela e faixa de ponta a ponta, e eles sao texto.
function Padded({ children }) {
  return <div className="p-6">{children}</div>;
}

function countHint(visible, total) {
  if (visible === total) {
    return `${total} ${total === 1 ? 'produto' : 'produtos'}`;
  }

  return `${visible} de ${total}`;
}

/**
 * Coluna central: busca, tabela ou cartoes conforme a largura, e as acoes de
 * editar e remover por item.
 *
 * Ela e a unica regiao elastica da tela, e por isso ocupa o meio: e a unica
 * cujo valor cresce com o tamanho do monitor. A configuracao do trabalho e a
 * previa tem a largura de que precisam.
 *
 * A busca fica na faixa fixa, junto da contagem; o que rola e so a lista. Com
 * trezentos produtos no banco, um campo de busca que sobe junto com a rolagem
 * obriga a voltar ao topo para trocar o termo.
 *
 * O termo de busca vive aqui porque so esta tela o consome. A edicao sobe para
 * quem montou a tela, que decide onde o formulario aparece; a remocao passa
 * antes por uma confirmacao que mostra qual produto sai.
 *
 * `loadError` cobre a leitura inicial que nao completou: enquanto nao houver
 * nenhum produto para mostrar, o aviso e a nova tentativa ocupam o lugar da
 * lista. Com produtos ja carregados, a ultima lista boa continua na tela.
 *
 * A marcacao para a folha de etiquetas so atravessa esta tela: o conjunto do que
 * esta marcado e o alternador chegam prontos e descem para as duas superficies.
 * A listagem nao guarda essa escolha, porque quem a consome e o painel da folha.
 */
export default function ProductList({
  products,
  isLoading,
  loadError = null,
  selectedProductId = null,
  printSelection,
  onTogglePrint,
  onRetryLoad,
  onEdit,
  onPreview,
  onRemove,
}) {
  const [query, setQuery] = useState('');
  const [productToRemove, setProductToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removalError, setRemovalError] = useState(null);

  const visibleProducts = useMemo(
    () => [...searchProducts(products, query)].sort(compareProductsByName),
    [products, query],
  );

  // A confirmacao que falha mantem o dialogo aberto: o produto continua na lista
  // e no armazenamento, e e isso que a tela precisa dizer. Confirmar de novo e a
  // nova tentativa; cancelar descarta.
  async function handleConfirmRemoval() {
    setIsRemoving(true);
    setRemovalError(null);

    try {
      await onRemove(productToRemove.id);
      setProductToRemove(null);
    } catch (error) {
      setRemovalError(describeStorageError(error));
    } finally {
      setIsRemoving(false);
    }
  }

  function handleCancelRemoval() {
    setProductToRemove(null);
    setRemovalError(null);
  }

  function handleStartRemoval(product) {
    setProductToRemove(product);
    setRemovalError(null);
  }

  function renderBody() {
    if (products.length === 0 && loadError) {
      return (
        <Padded>
          <LoadFailureStatus message={loadError} onRetry={onRetryLoad} />
        </Padded>
      );
    }

    if (isLoading && products.length === 0) {
      return (
        <Padded>
          <LoadingStatus />
        </Padded>
      );
    }

    if (products.length === 0) {
      return (
        <Padded>
          <EmptyCatalogStatus />
        </Padded>
      );
    }

    if (visibleProducts.length === 0) {
      return (
        <Padded>
          <NoMatchStatus query={query} onClearSearch={() => setQuery('')} />
        </Padded>
      );
    }

    return (
      <>
        <div className="hidden sm:block">
          <ProductTable
            products={visibleProducts}
            selectedProductId={selectedProductId}
            printSelection={printSelection}
            onTogglePrint={onTogglePrint}
            onEdit={onEdit}
            onPreview={onPreview}
            onRemove={handleStartRemoval}
          />
        </div>

        <div className="p-6 sm:hidden">
          <ProductCards
            products={visibleProducts}
            selectedProductId={selectedProductId}
            printSelection={printSelection}
            onTogglePrint={onTogglePrint}
            onEdit={onEdit}
            onPreview={onPreview}
            onRemove={handleStartRemoval}
          />
        </div>
      </>
    );
  }

  const header =
    products.length > 0 ? (
      <div className="border-b border-neutro-borda px-6 py-3.5">
        <ProductSearchField
          value={query}
          onChange={setQuery}
          hint={countHint(visibleProducts.length, products.length)}
        />
      </div>
    ) : null;

  return (
    <>
      <ShellColumn
        label="Produtos cadastrados"
        header={header}
        bodyClassName=""
        className="bg-neutro-papel"
      >
        {renderBody()}
      </ShellColumn>

      {productToRemove ? (
        <ConfirmModal
          title="Remover produto"
          subtitle={productToRemove.displayName}
          confirmLabel="Remover produto"
          isConfirming={isRemoving}
          error={removalError}
          onConfirm={handleConfirmRemoval}
          onCancel={handleCancelRemoval}
        >
          <p>
            O produto sai da lista e do armazenamento deste dispositivo, junto com o código e o
            preço cadastrados.
          </p>
          <p>Para usá-lo de novo depois, será preciso cadastrá-lo outra vez.</p>
        </ConfirmModal>
      ) : null}
    </>
  );
}
