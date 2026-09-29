import { useMemo, useRef, useState } from 'react';

import { compareProductsByName, searchProducts } from '../../domain/services/productSearch.js';
import { describeStorageError } from '../../storage/storageError.js';

import ShellColumn from '../layout/ShellColumn.jsx';
import ConfirmModal from '../ui/ConfirmModal.jsx';

import ClearCatalogButton from './ClearCatalogButton.jsx';
import {
  clampListPage,
  countListPages,
  itemsOnListPage,
  listPageRange,
} from './listPage.js';
import ProductCards from './ProductCards.jsx';
import {
  EmptyCatalogStatus,
  LoadFailureStatus,
  LoadingStatus,
  NoMatchStatus,
} from './ProductListStatus.jsx';
import ProductListPager from './ProductListPager.jsx';
import ProductSearchField from './ProductSearchField.jsx';
import ProductTable from './ProductTable.jsx';

// Os avisos de estado nao encostam na borda da coluna como a tabela encosta: a
// tabela e faixa de ponta a ponta, e eles sao texto.
function Padded({ children }) {
  return <div className="p-recuo">{children}</div>;
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
 * `Zerar catalogo` fica na faixa fixa, ao lado da busca, e so existe com
 * produto na lista. O que acontece depois da limpeza com a selecao da folha e
 * a previa e de quem monta a tela, que recebe o pedido por `onClearCatalog`.
 *
 * A marcacao para a folha de etiquetas so atravessa esta tela: o conjunto do que
 * esta marcado e o alternador chegam prontos e descem para as duas superficies.
 * A listagem nao guarda essa escolha, porque quem a consome e o painel da folha.
 * Por isso trocar de pagina nao mexe no que esta marcado.
 *
 * A tabela e os cartoes recebem uma pagina do resultado, e nao o resultado
 * inteiro: com o catalogo completo na tela, a montagem levava minutos. A busca
 * continua sobre o catalogo inteiro, e a pagina sai do que ela devolveu, ja em
 * ordem de nome. Trocar o termo volta a primeira pagina, porque o resultado e
 * outro. Cadastrar, editar, remover e reler o catalogo mantem a pagina, e
 * quando ela deixa de existir a tela mostra a nova ultima. A troca de pagina
 * leva a lista de volta ao topo.
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
  onClearCatalog,
}) {
  const [query, setQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const listRef = useRef(null);
  const [productToRemove, setProductToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removalError, setRemovalError] = useState(null);

  const visibleProducts = useMemo(
    () => [...searchProducts(products, query)].sort(compareProductsByName),
    [products, query],
  );

  const totalPages = countListPages(visibleProducts.length);
  const currentPage = clampListPage(pageIndex, totalPages);

  // A pagina guardada acompanha a que esta na tela. Sem isso, a pagina que
  // deixou de existir voltaria a aparecer quando o resultado crescesse de novo.
  if (currentPage !== pageIndex) {
    setPageIndex(currentPage);
  }

  const pageProducts = useMemo(
    () => itemsOnListPage(visibleProducts, currentPage),
    [visibleProducts, currentPage],
  );

  function handleQueryChange(value) {
    setQuery(value);
    setPageIndex(0);
  }

  // O corpo que rola e o da coluna, e ele continua o mesmo entre as paginas:
  // sem voltar ao topo, a pagina nova abriria pelo fim.
  function handlePageChange(nextPage) {
    setPageIndex(clampListPage(nextPage, totalPages));

    const body = listRef.current?.closest('[data-corpo]');

    if (body) {
      body.scrollTop = 0;
    }
  }

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
          <NoMatchStatus query={query} onClearSearch={() => handleQueryChange('')} />
        </Padded>
      );
    }

    return (
      <div ref={listRef}>
        <div className="hidden sm:block">
          <ProductTable
            products={pageProducts}
            selectedProductId={selectedProductId}
            printSelection={printSelection}
            onTogglePrint={onTogglePrint}
            onEdit={onEdit}
            onPreview={onPreview}
            onRemove={handleStartRemoval}
          />
        </div>

        <div className="p-recuo sm:hidden">
          <ProductCards
            products={pageProducts}
            selectedProductId={selectedProductId}
            printSelection={printSelection}
            onTogglePrint={onTogglePrint}
            onEdit={onEdit}
            onPreview={onPreview}
            onRemove={handleStartRemoval}
          />
        </div>
      </div>
    );
  }

  const header =
    products.length > 0 ? (
      <div className="flex items-end gap-3 border-b border-neutro-borda px-recuo py-3 lg:py-2.5">
        <div className="min-w-0 flex-1">
          <ProductSearchField
            value={query}
            onChange={handleQueryChange}
            hint={countHint(visibleProducts.length, products.length)}
          />
        </div>

        {onClearCatalog ? (
          <ClearCatalogButton total={products.length} onClear={onClearCatalog} className="shrink-0" />
        ) : null}
      </div>
    ) : null;

  const { first, last } = listPageRange(visibleProducts.length, currentPage);

  // Os avisos de estado ocupam o lugar da lista, e entao nao ha o que paginar.
  const footer =
    totalPages > 1 ? (
      <ProductListPager
        pageIndex={currentPage}
        totalPages={totalPages}
        first={first}
        last={last}
        onChange={handlePageChange}
      />
    ) : null;

  return (
    <>
      <ShellColumn
        label="Produtos cadastrados"
        header={header}
        footer={footer}
        flush
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
