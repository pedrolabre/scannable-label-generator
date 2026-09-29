// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { compareProductsByName } from '../../domain/services/productSearch.js';

import { inventCatalog } from './listFixtures.js';
import ProductList from './ProductList.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Os casos montam a listagem inteira no jsdom, e o tempo de cada um varia com a
// carga da maquina: o limite padrao de 5 s nao comporta essa variacao.
vi.setConfig({ testTimeout: 30_000 });

const NEXT = 'Próxima: ir para a próxima página';

let container;
let root;
let current;

// Faz o papel de quem monta a tela: guarda os props da ultima montagem e
// remonta com o que mudou, como o App faz quando o catalogo em memoria troca.
async function render(overrides = {}) {
  current = { ...current, ...overrides };

  await act(async () => {
    root.render(<ProductList {...current} />);
  });
}

function sorted(products) {
  return [...products].sort(compareProductsByName);
}

function tableNames() {
  return Array.from(container.querySelectorAll('tbody tr'), (row) =>
    row.querySelector('td:nth-child(2) p').textContent,
  );
}

function position() {
  return container.querySelector('[data-list-pager] p')?.textContent ?? null;
}

function button(label, scope = container) {
  return Array.from(scope.querySelectorAll('button')).find(
    (element) => element.getAttribute('aria-label') === label || element.textContent.trim() === label,
  );
}

async function click(label, scope) {
  const target = button(label, scope);

  expect(target, `botão "${label}" não encontrado`).toBeTruthy();

  await act(async () => {
    target.click();
  });
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
  current = {
    products: [],
    isLoading: false,
    loadError: null,
    selectedProductId: null,
    printSelection: new Set(),
    onTogglePrint: vi.fn(),
    onRetryLoad: vi.fn(),
    onEdit: vi.fn(),
    onPreview: vi.fn(),
    onRemove: vi.fn(async () => {}),
    onClearCatalog: vi.fn(async () => {}),
  };
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe('volta ao inicio e pagina mantida', () => {
  it('volta a primeira pagina quando o termo de busca muda', async () => {
    await render({ products: inventCatalog(300) });
    await click(NEXT);
    await click(NEXT);
    await typeSearch('o');

    expect(position()).toMatch(/^Página 1 de /);
  });

  it('mantem a pagina na edicao, no cadastro e depois de uma importacao', async () => {
    const products = inventCatalog(120);

    await render({ products });
    await click(NEXT);

    const onPage = sorted(products)[60];
    const edited = products.map((product) =>
      product.id === onPage.id ? { ...product, priceInCentavos: 12345 } : product,
    );
    await render({ products: edited });
    expect(position()).toBe('Página 2 de 3 · 51–100');

    await render({ products: [...edited, ...inventCatalog(1, 500)] });
    expect(position()).toBe('Página 2 de 3 · 51–100');

    await render({ products: [...edited, ...inventCatalog(200, 1000)] });
    expect(position()).toBe('Página 2 de 7 · 51–100');
  });

  it('remover o ultimo produto da ultima pagina mostra a nova ultima', async () => {
    const products = inventCatalog(101);
    const last = sorted(products)[100];

    current.onRemove = vi.fn(async (id) => {
      await render({ products: current.products.filter((product) => product.id !== id) });
    });

    await render({ products });
    await click(NEXT);
    await click(NEXT);

    expect(tableNames()).toEqual([last.displayName]);

    await click(`Remover ${last.displayName}`);
    await click('Remover produto', document.querySelector('[role="dialog"]'));

    expect(current.onRemove).toHaveBeenCalledWith(last.id);
    expect(position()).toBe('Página 2 de 2 · 51–100');
    expect(tableNames()).toEqual(sorted(products).slice(50, 100).map((product) => product.displayName));
  });

  it('a pagina que deixou de existir nao volta quando o resultado cresce', async () => {
    const products = inventCatalog(120);

    await render({ products });
    await click(NEXT);
    await click(NEXT);
    await render({ products: products.slice(0, 80) });

    expect(position()).toBe('Página 2 de 2 · 51–80');

    await render({ products });

    expect(position()).toBe('Página 2 de 3 · 51–100');
  });

  it('nao vai ate a pagina do produto escolhido para a previa', async () => {
    const products = inventCatalog(120);

    await render({ products });
    await click(NEXT);
    await click(NEXT);
    await render({ selectedProductId: sorted(products)[0].id });

    expect(position()).toBe('Página 3 de 3 · 101–120');
  });
});

describe('acoes numa pagina que nao e a primeira', () => {
  it('editar, ver etiqueta e marcar agem sobre o produto da linha', async () => {
    const products = inventCatalog(120);
    const target = sorted(products)[73];

    await render({ products });
    await click(NEXT);

    await click(`Editar ${target.displayName}`);
    expect(current.onEdit).toHaveBeenCalledTimes(1);
    expect(current.onEdit.mock.calls[0][0].id).toBe(target.id);

    await click(`Ver etiqueta de ${target.displayName}`);
    expect(current.onPreview).toHaveBeenCalledTimes(1);
    expect(current.onPreview.mock.calls[0][0].id).toBe(target.id);

    const checkbox = container.querySelector(
      `tbody input[aria-label="Imprimir etiqueta de ${target.displayName}"]`,
    );
    await act(async () => {
      checkbox.click();
    });
    expect(current.onTogglePrint).toHaveBeenCalledWith(target.id);
  });

  it('remover pede confirmacao com o nome do produto da linha', async () => {
    const products = inventCatalog(120);
    const target = sorted(products)[110];

    await render({ products });
    await click(NEXT);
    await click(NEXT);
    await click(`Remover ${target.displayName}`);

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain(target.displayName);

    await click('Remover produto', dialog);
    expect(current.onRemove).toHaveBeenCalledWith(target.id);
  });
});
