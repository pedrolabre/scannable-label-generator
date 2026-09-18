import { useCallback, useMemo, useRef, useState } from 'react';

import AppShell from './components/AppShell.jsx';
import AppHeader from './components/AppHeader.jsx';
import LocalOnlyNotice from './components/LocalOnlyNotice.jsx';
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

  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const formRef = useRef(null);
  const previewRef = useRef(null);

  // A previa e guardada por identificador, e o produto desenhado sai da lista
  // atual. Assim o produto editado aparece ja atualizado, o produto removido
  // some da previa, e uma releitura da listagem nao derruba a escolha.
  const selectedProduct = useMemo(
    () => resolveSelectedProduct(products, selectedProductId),
    [products, selectedProductId],
  );

  // A listagem consulta item a item se aquele produto vai para a folha, entao
  // recebe um conjunto em vez da lista ordenada que o painel da folha consome.
  const printSelectionIds = useMemo(() => selectedPrintIds(printSelection), [printSelection]);

  // A listagem fica abaixo do formulario: escolher um produto para editar leva
  // a pagina de volta ao formulario ja preenchido.
  const handleEdit = useCallback((product) => {
    setEditingProduct(product);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Escolher a etiqueta segue o mesmo caminho da edicao: a acao acontece na
  // listagem e a pagina leva ate o painel que respondeu a ela.
  const handlePreview = useCallback((product) => {
    setSelectedProductId(product.id);
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // As tres acoes deixam a falha subir para quem as chamou: o formulario e o
  // dialogo de remocao sao os dois lugares onde o usuario ve o que aconteceu e
  // tenta de novo. O que vem depois do `await` so roda quando a gravacao entrou
  // no armazenamento, entao uma falha nao limpa o formulario nem encerra a
  // edicao em andamento.
  const handleSubmit = useCallback(
    async (product) => {
      if (editingProduct) {
        await updateProduct(product);
        setEditingProduct(null);
        return;
      }

      await addProduct(product);
    },
    [addProduct, editingProduct, updateProduct],
  );

  const handleRemove = useCallback(
    async (id) => {
      await removeProduct(id);
      setEditingProduct((current) => (current?.id === id ? null : current));
    },
    [removeProduct],
  );

  // O motivo da falha ja fica em `loadError`, e a listagem o exibe junto da
  // propria acao de tentar de novo.
  const handleRetryLoad = useCallback(() => {
    loadProducts().catch(() => {});
  }, [loadProducts]);

  return (
    <AppShell header={<AppHeader />}>
      <div className="w-full space-y-6">
        <UpdateNotice />

        <LocalOnlyNotice />

        <ImportPanel />

        <div ref={formRef}>
          <ProductForm
            key={editingProduct?.id ?? 'novo'}
            product={editingProduct}
            onSubmit={handleSubmit}
            onCancel={editingProduct ? () => setEditingProduct(null) : undefined}
          />
        </div>

        <div ref={previewRef}>
          <LabelPreviewPanel product={selectedProduct} hasProducts={products.length > 0} />
        </div>

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

        <PrintJobPanel products={products} />
      </div>
    </AppShell>
  );
}
