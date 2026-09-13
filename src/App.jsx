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
          onEdit={handleEdit}
          onRemove={handleRemove}
        />
      </div>
    </AppShell>
  );
}
