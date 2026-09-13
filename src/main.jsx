import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import { useProductStore } from './store/useProductStore.js';
import './styles/global.css';

// A leitura dos produtos salvos no dispositivo comeca junto com a montagem e
// corre em paralelo: a primeira tela aparece sem esperar o IndexedDB responder.
// A falha fica registrada no store, e a listagem e quem a mostra ao usuario com
// a acao de tentar de novo; aqui ela vai para o console de quem desenvolve.
useProductStore
  .getState()
  .loadProducts()
  .catch((error) => {
    console.error('Falha ao carregar os produtos salvos no dispositivo.', error);
  });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
