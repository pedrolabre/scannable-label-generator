// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { compareProductsByName, normalizeSearchText } from '../../domain/services/productSearch.js';

import { inventCatalog } from './listFixtures.js';
import ProductList from './ProductList.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Os casos montam a listagem inteira no jsdom, e o tempo de cada um varia com a
// carga da maquina: o limite padrao de 5 s nao comporta essa variacao.
vi.setConfig({ testTimeout: 30_000 });

let container;
let root;

function props(overrides = {}) {
  return {
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
    ...overrides,
  };
}

async function render(overrides) {
  await act(async () => {
    root.render(<ProductList {...props(overrides)} />);
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

function cardNames() {
  return Array.from(container.querySelectorAll('ul > li'), (item) =>
    item.querySelector('p').textContent,
  );
}

function pager() {
  return container.querySelector('[data-list-pager]');
}

function position() {
  return pager()?.querySelector('p').textContent ?? null;
}

function button(label) {
  return Array.from(container.querySelectorAll('button')).find(
    (element) => element.getAttribute('aria-label') === label || element.textContent.trim() === label,
  );
}

async function click(label) {
  const target = button(label);

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

function searchHint() {
  return container.querySelector('#product-search').closest('div').parentElement.textContent;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe('catalogo grande', () => {
  it('com 19.000 produtos, poe no DOM so 50 linhas e 50 cartoes', async () => {
    const products = inventCatalog(19_000);

    await render({ products });

    expect(container.querySelectorAll('tbody tr')).toHaveLength(50);
    expect(container.querySelectorAll('ul > li')).toHaveLength(50);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(100);
    expect(position()).toBe('Página 1 de 380 · 1–50');
    expect(searchHint()).toContain('19000 produtos');
  });
});

describe('navegacao entre paginas', () => {
  it('mostra a pagina seguinte do resultado em ordem de nome, na tabela e nos cartoes', async () => {
    const products = inventCatalog(120);
    const expected = sorted(products).map((product) => product.displayName);

    await render({ products });

    expect(tableNames()).toEqual(expected.slice(0, 50));
    expect(cardNames()).toEqual(expected.slice(0, 50));
    expect(button('Anterior: ir para a página anterior').disabled).toBe(true);

    await click('Próxima: ir para a próxima página');

    expect(position()).toBe('Página 2 de 3 · 51–100');
    expect(tableNames()).toEqual(expected.slice(50, 100));
    expect(cardNames()).toEqual(expected.slice(50, 100));
  });

  it('chega a ultima pagina incompleta e volta', async () => {
    const products = inventCatalog(120);
    const expected = sorted(products).map((product) => product.displayName);

    await render({ products });
    await click('Próxima: ir para a próxima página');
    await click('Próxima: ir para a próxima página');

    expect(position()).toBe('Página 3 de 3 · 101–120');
    expect(tableNames()).toEqual(expected.slice(100));
    expect(container.querySelectorAll('ul > li')).toHaveLength(20);
    expect(button('Próxima: ir para a próxima página').disabled).toBe(true);

    await click('Anterior: ir para a página anterior');

    expect(position()).toBe('Página 2 de 3 · 51–100');
  });

  it('nao tem controle quando tudo cabe numa pagina', async () => {
    await render({ products: inventCatalog(50) });

    expect(pager()).toBeNull();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(50);

    await render({ products: inventCatalog(3) });

    expect(pager()).toBeNull();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(container.querySelectorAll('ul > li')).toHaveLength(3);
    expect(searchHint()).toContain('3 produtos');
  });

  it('abre o controle a partir do primeiro produto que nao cabe', async () => {
    await render({ products: inventCatalog(51) });

    expect(position()).toBe('Página 1 de 2 · 1–50');
  });

  it('leva a lista de volta ao topo na troca de pagina', async () => {
    await render({ products: inventCatalog(120) });

    const body = container.querySelector('[data-corpo]');
    body.scrollTop = 900;

    await click('Próxima: ir para a próxima página');

    expect(body.scrollTop).toBe(0);
  });
});

describe('busca sobre o catalogo inteiro', () => {
  it('encontra sem acento e sem caixa um produto que estaria numa pagina posterior', async () => {
    const products = inventCatalog(200);
    const order = sorted(products);
    const target = order.find((product, index) => index >= 100 && product.displayName.startsWith('Sofá'));

    await render({ products });

    expect(tableNames()).not.toContain(target.displayName);

    await typeSearch(target.displayName.toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, ''));

    expect(tableNames()).toEqual([target.displayName]);
    expect(pager()).toBeNull();
    expect(searchHint()).toContain('1 de 200');
  });

  it('pagina o resultado filtrado e ordenado, e nao o catalogo', async () => {
    const products = inventCatalog(300);
    const term = 'ao';
    const filtered = sorted(
      products.filter((product) => normalizeSearchText(product.displayName).includes(term)),
    ).map((product) => product.displayName);

    await render({ products });
    await typeSearch(term);

    expect(filtered.length).toBeGreaterThan(50);
    expect(tableNames()).toEqual(filtered.slice(0, 50));
    expect(position()).toBe(`Página 1 de ${Math.ceil(filtered.length / 50)} · 1–50`);
    expect(searchHint()).toContain(`${filtered.length} de 300`);
  });
});

describe('estados sem lista', () => {
  it('carregando, sem controle de pagina', async () => {
    await render({ isLoading: true });

    expect(container.textContent).toContain('Carregando produtos');
    expect(pager()).toBeNull();
  });

  it('falha de leitura, com a nova tentativa', async () => {
    const onRetryLoad = vi.fn();

    await render({ loadError: 'O armazenamento não respondeu.', onRetryLoad });

    expect(container.textContent).toContain('Falha ao ler os produtos salvos');
    expect(container.textContent).toContain('O armazenamento não respondeu.');
    await click('Tentar de novo');
    expect(onRetryLoad).toHaveBeenCalledTimes(1);
    expect(pager()).toBeNull();
  });

  it('catalogo vazio', async () => {
    await render({ products: [] });

    expect(container.textContent).toContain('Nenhum produto cadastrado');
    expect(container.querySelector('#product-search')).toBeNull();
    expect(pager()).toBeNull();
  });

  it('busca sem resultado, e limpar a busca devolve a primeira pagina', async () => {
    await render({ products: inventCatalog(120) });
    await click('Próxima: ir para a próxima página');
    await typeSearch('poltrona inexistente');

    expect(container.textContent).toContain('Nenhum produto encontrado');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(pager()).toBeNull();

    await click('Limpar busca');

    expect(position()).toBe('Página 1 de 3 · 1–50');
  });
});
