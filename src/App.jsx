import { useCallback, useRef, useState } from 'react';

import AppShell from './components/AppShell.jsx';
import AppHeader from './components/AppHeader.jsx';
import LocalOnlyNotice from './components/LocalOnlyNotice.jsx';
import ProductForm from './components/product-form/ProductForm.jsx';
import ProductList from './components/product-list/ProductList.jsx';
import { useProductStore } from './store/useProductStore.js';

export default function App() {
  const products = useProductStore((state) => state.products);
  const isLoading = useProductStore((state) => state.isLoading);
  const loadError = useProductStore((state) => state.loadError);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const addProduct = useProductStore((state) => state.addProduct);
  const updateProduct = useProductStore((state) => state.updateProduct);
  const removeProduct = useProductStore((state) => state.removeProduct);

  const [editingProduct, setEditingProduct] = useState(null);
  const formRef = useRef(null);

  // A listagem fica abaixo do formulario: escolher um produto para editar leva
  // a pagina de volta ao formulario ja preenchido.
  const handleEdit = useCallback((product) => {
    setEditingProduct(product);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <LocalOnlyNotice />

        <div ref={formRef}>
          <ProductForm
            key={editingProduct?.id ?? 'novo'}
            product={editingProduct}
            onSubmit={handleSubmit}
            onCancel={editingProduct ? () => setEditingProduct(null) : undefined}
          />
        </div>

        <ProductList
          products={products}
          isLoading={isLoading}
          loadError={loadError}
          onRetryLoad={handleRetryLoad}
          onEdit={handleEdit}
          onRemove={handleRemove}
        />
      </div>
    </AppShell>
  );
}
