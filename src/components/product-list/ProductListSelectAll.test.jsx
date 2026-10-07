// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { compareProductsByName } from '../../domain/services/productSearch.js';
import { usePrintJobStore } from '../../store/usePrintJobStore.js';

import { inventCatalog } from './listFixtures.js';
import ProductList from './ProductList.jsx';
import { describeSelectAllForPrint } from './SelectAllForPrint.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const PRODUCTS = inventCatalog(120);
const SORTED_IDS = [...PRODUCTS].sort(compareProductsByName).map((product) => product.id);

function props(overrides = {}) {
  return {
    products: PRODUCTS,
    isLoading: false,
    loadError: null,
    selectedProductId: null,
    printSelection: new Set(),
    onTogglePrint: vi.fn(),
    onSetPrintSelection: vi.fn(),
    onRetryLoad: vi.fn(),
    onEdit: vi.fn(),
    onPreview: vi.fn(),
    onRemove: vi.fn(async () => {}),
    onClearCatalog: vi.fn(async () => {}),
    ...overrides,
  };
}

async function render(overrides) {
  const current = props(overrides);

  await act(async () => {
    root.render(<ProductList {...current} />);
  });

  return current;
}

function tableSelectAll() {
  return container.querySelector('thead input[data-select-all-print]');
}

function cardsSelectAll() {
  return container.querySelector('.sm\\:hidden input[data-select-all-print]');
}

async function typeSearch(term) {
  const input = container.querySelector('#product-search');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

  await act(async () => {
    setter.call(input, term);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  usePrintJobStore.getState().resetPrintJob();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe('estado da caixa de marcar todos', () => {
  it('desmarcada, no meio ou marcada, conforme o que da lista esta marcado', () => {
    const ids = ['a', 'b', 'c'];

    expect(describeSelectAllForPrint(ids, new Set())).toMatchObject({
      checked: false,
      partial: false,
      label: 'Marcar os 3 produtos da lista para imprimir',
    });
    expect(describeSelectAllForPrint(ids, new Set(['b', 'z']))).toMatchObject({
      checked: false,
      partial: true,
      marked: 1,
    });
    expect(describeSelectAllForPrint(ids, new Set(['a', 'b', 'c']))).toMatchObject({
      checked: true,
      partial: false,
      label: 'Desmarcar os 3 produtos da lista para imprimir',
    });
    expect(describeSelectAllForPrint([], new Set(['a']))).toMatchObject({ checked: false, partial: false });
  });
});

describe('marcar varios no trabalho de impressao', () => {
  it('acrescenta ao fim, na ordem recebida, sem repetir e sem mexer nas copias de quem ja estava', () => {
    const store = usePrintJobStore.getState();

    store.toggleProduct('b');
    store.setCopies('b', '3');
    usePrintJobStore.getState().setProductsSelected(['a', 'b', 'c'], true);

    expect(usePrintJobStore.getState().selection).toEqual([
      { productId: 'b', copies: '3' },
      { productId: 'a', copies: '1' },
      { productId: 'c', copies: '1' },
    ]);
  });

  it('desmarcar tira so os recebidos', () => {
    usePrintJobStore.getState().setProductsSelected(['a', 'b', 'c', 'd'], true);
    usePrintJobStore.getState().setProductsSelected(['b', 'd'], false);

    expect(usePrintJobStore.getState().selection.map((entry) => entry.productId)).toEqual(['a', 'c']);
  });
});

describe('caixa de marcar todos na listagem', () => {
  it('marca a lista inteira, em todas as paginas, e nao so a pagina na tela', async () => {
    const current = await render();

    expect(container.querySelectorAll('tbody tr')).toHaveLength(50);

    await act(async () => {
      tableSelectAll().click();
    });

    expect(current.onSetPrintSelection).toHaveBeenCalledTimes(1);
    expect(current.onSetPrintSelection).toHaveBeenCalledWith(SORTED_IDS, true);
  });

  it('com a lista inteira marcada, desmarca a lista inteira', async () => {
    const current = await render({ printSelection: new Set(SORTED_IDS) });

    expect(tableSelectAll().checked).toBe(true);
    expect(tableSelectAll().getAttribute('aria-label')).toBe('Desmarcar os 120 produtos da lista para imprimir');

    await act(async () => {
      tableSelectAll().click();
    });

    expect(current.onSetPrintSelection).toHaveBeenCalledWith(SORTED_IDS, false);
  });

  it('fica no meio quando so parte da lista esta marcada, e o clique marca o resto', async () => {
    const current = await render({ printSelection: new Set(SORTED_IDS.slice(0, 3)) });

    expect(tableSelectAll().checked).toBe(false);
    expect(tableSelectAll().indeterminate).toBe(true);
    expect(cardsSelectAll().indeterminate).toBe(true);

    await act(async () => {
      cardsSelectAll().click();
    });

    expect(current.onSetPrintSelection).toHaveBeenCalledWith(SORTED_IDS, true);
  });

  it('com busca, marca so o que a busca devolveu', async () => {
    const current = await render();
    const expected = [...PRODUCTS]
      .filter((product) => product.displayName.startsWith('Rack para TV'))
      .sort(compareProductsByName)
      .map((product) => product.id);

    await typeSearch('rack');

    expect(expected).toHaveLength(12);
    expect(tableSelectAll().getAttribute('aria-label')).toBe('Marcar os 12 produtos da lista para imprimir');

    await act(async () => {
      tableSelectAll().click();
    });

    expect(current.onSetPrintSelection).toHaveBeenCalledWith(expected, true);
  });
});
