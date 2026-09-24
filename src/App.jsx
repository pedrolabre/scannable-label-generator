import { useCallback, useMemo, useState } from 'react';

import AppHeader from './components/AppHeader.jsx';
import AppShell from './components/AppShell.jsx';
import StatusBar from './components/layout/StatusBar.jsx';
import BackupPanel from './components/backup/BackupPanel.jsx';
import ImportPanel from './components/import/ImportPanel.jsx';
import LabelPreviewPanel from './components/label/LabelPreviewPanel.jsx';
import { resolveSelectedProduct } from './components/label/previewSelection.js';
import PrintJobPanel from './components/print/PrintJobPanel.jsx';
import { selectedPrintIds } from './components/print/printSelection.js';
import ProductForm from './components/product-form/ProductForm.jsx';
import ProductList from './components/product-list/ProductList.jsx';
import UpdateNotice from './components/pwa/UpdateNotice.jsx';
import { usePrintJobStore } from './store/usePrintJobStore.js';
import { useProductStore } from './store/useProductStore.js';

/**
 * Montagem da tela e o pouco de estado que nao pertence a nenhuma coluna.
 *
 * Um dialogo por vez, e por isso `openModal` guarda um identificador e nao uma
 * pilha: dois dialogos abertos ao mesmo tempo dariam duas ordens de foco e duas
 * leituras de `Esc`. Cadastro aberto por cima da importacao nao e um caso de
 * uso, e sim o que acontece quando ninguem decidiu.
 *
 * Os tres valores de tela sao locais e morrem no recarregamento — nada disso
 * vai para o armazenamento nem para um store. E a mesma decisao ja tomada para
 * o seletor de modelo e para a ampliacao: estado de tela nao sobrevive ao
 * recarregamento.
 *
 * `editingProductId` guarda identificador, e nao o objeto do produto. Assim o
 * formulario aberto sobre um produto que acabou de ser editado em outro lugar
 * abre com o valor atual, e o produto removido nao deixa um fantasma no
 * formulario.
 *
 * A previa ampliada e o quarto dialogo, e o identificador dela mora aqui pelo
 * mesmo motivo dos outros tres. Quem o desenha e a coluna da direita, porque e
 * la que vivem o modelo e o degrau de ampliacao: separar o que abre de quem
 * desenha e o que impede que a ampliacao da coluna e a do dialogo virem dois
 * valores diferentes.
 */

const MODALS = Object.freeze({
  PRODUCT: 'produto',
  IMPORT: 'importacao',
  PREVIEW: 'previa',
  BACKUP: 'backup',
});

export default function App() {
  const products = useProductStore((state) => state.products);
  const isLoading = useProductStore((state) => state.isLoading);
  const loadError = useProductStore((state) => state.loadError);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const addProduct = useProductStore((state) => state.addProduct);
  const updateProduct = useProductStore((state) => state.updateProduct);
  const removeProduct = useProductStore((state) => state.removeProduct);

  const printSelection = usePrintJobStore((state) => state.selection);
  const togglePrintProduct = usePrintJobStore((state) => state.toggleProduct);
  const clearPrintSelection = usePrintJobStore((state) => state.clearSelection);

  const [openModal, setOpenModal] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);

  // A previa e guardada por identificador, e o produto desenhado sai da lista
  // atual. Assim o produto editado aparece ja atualizado, o produto removido
  // some da previa, e uma releitura da listagem nao derruba a escolha.
  const selectedProduct = useMemo(
    () => resolveSelectedProduct(products, selectedProductId),
    [products, selectedProductId],
  );

  const editingProduct = useMemo(
    () => resolveSelectedProduct(products, editingProductId),
    [products, editingProductId],
  );

  // A listagem consulta item a item se aquele produto vai para a folha, entao
  // recebe um conjunto em vez da lista ordenada que o painel da folha consome.
  const printSelectionIds = useMemo(() => selectedPrintIds(printSelection), [printSelection]);

  const closeModal = useCallback(() => {
    setOpenModal(null);
    setEditingProductId(null);
  }, []);

  const handleNewProduct = useCallback(() => {
    setEditingProductId(null);
    setOpenModal(MODALS.PRODUCT);
  }, []);

  const handleEdit = useCallback((product) => {
    setEditingProductId(product.id);
    setOpenModal(MODALS.PRODUCT);
  }, []);

  const handleEditById = useCallback((id) => {
    setEditingProductId(id);
    setOpenModal(MODALS.PRODUCT);
  }, []);

  const handlePreview = useCallback((product) => {
    setSelectedProductId(product.id);
  }, []);

  // As tres acoes deixam a falha subir para quem as chamou: o formulario e o
  // dialogo de remocao sao os dois lugares onde o usuario ve o que aconteceu e
  // tenta de novo. O que vem depois do `await` so roda quando a gravacao entrou
  // no armazenamento, entao uma falha nao fecha o dialogo nem encerra a edicao
  // em andamento.
  const handleSubmit = useCallback(
    async (product) => {
      if (editingProductId) {
        await updateProduct(product);
      } else {
        await addProduct(product);
      }

      closeModal();
    },
    [addProduct, closeModal, editingProductId, updateProduct],
  );

  const handleRemove = useCallback(
    async (id) => {
      await removeProduct(id);
      setEditingProductId((current) => (current === id ? null : current));
    },
    [removeProduct],
  );

  // O motivo da falha ja fica em `loadError`, e a listagem o exibe junto da
  // propria acao de tentar de novo.
  const handleRetryLoad = useCallback(() => {
    loadProducts().catch(() => {});
  }, [loadProducts]);

  // A restauracao troca o catalogo inteiro, entao tudo o que a tela guardava por
  // identificador deixa de valer: a edicao em andamento, a etiqueta escolhida
  // para a previa e a selecao da folha podem apontar para produtos que nao
  // existem mais. Os tres sao zerados antes da releitura.
  //
  // A releitura falhando nao derruba a restauracao, que ja terminou: o motivo
  // fica em `loadError` e a listagem o exibe junto da acao de tentar de novo.
  const handleRestored = useCallback(async () => {
    setEditingProductId(null);
    setSelectedProductId(null);
    clearPrintSelection();

    await loadProducts().catch(() => {});
  }, [clearPrintSelection, loadProducts]);

  return (
    <>
      <AppShell
        header={
          <AppHeader
            onNewProduct={handleNewProduct}
            onImport={() => setOpenModal(MODALS.IMPORT)}
            onBackup={() => setOpenModal(MODALS.BACKUP)}
          />
        }
        left={<PrintJobPanel products={products} />}
        center={
          <ProductList
            products={products}
            isLoading={isLoading}
            loadError={loadError}
            selectedProductId={selectedProductId}
            printSelection={printSelectionIds}
            onTogglePrint={togglePrintProduct}
            onRetryLoad={handleRetryLoad}
            onEdit={handleEdit}
            onPreview={handlePreview}
            onRemove={handleRemove}
          />
        }
        right={
          <LabelPreviewPanel
            product={selectedProduct}
            hasProducts={products.length > 0}
            isEnlarged={openModal === MODALS.PREVIEW}
            onEnlarge={() => setOpenModal(MODALS.PREVIEW)}
            onCloseEnlarged={closeModal}
            onEditProduct={handleEditById}
          />
        }
        status={
          <StatusBar productCount={products.length} selectedCount={printSelectionIds.size} />
        }
      />

      <UpdateNotice />

      {openModal === MODALS.PRODUCT ? (
        <ProductForm
          key={editingProductId ?? 'novo'}
          product={editingProduct}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      ) : null}

      {openModal === MODALS.IMPORT ? <ImportPanel onClose={closeModal} /> : null}

      {openModal === MODALS.BACKUP ? (
        <BackupPanel
          productCount={products.length}
          onRestored={handleRestored}
          onClose={closeModal}
        />
      ) : null}
    </>
  );
}
