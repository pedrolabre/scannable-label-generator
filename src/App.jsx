import AppShell from './components/AppShell.jsx';
import AppHeader from './components/AppHeader.jsx';
import LocalOnlyNotice from './components/LocalOnlyNotice.jsx';
import ProductForm from './components/product-form/ProductForm.jsx';
import { useProductStore } from './store/useProductStore.js';

export default function App() {
  const addProduct = useProductStore((state) => state.addProduct);

  return (
    <AppShell header={<AppHeader />}>
      <div className="w-full space-y-6">
        <LocalOnlyNotice />
        <ProductForm onSubmit={addProduct} />
      </div>
    </AppShell>
  );
}
