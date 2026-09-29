// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { inventCatalog, inventProduct } from './listFixtures.js';
import ProductList from './ProductList.jsx';

vi.setConfig({ testTimeout: 30_000 });

let container;
let root;
let current;
let normalizations = 0;

const originalNormalize = String.prototype.normalize;

// Cada texto normalizado pela busca passa uma vez por normalize('NFD'). Contar
// essas chamadas diz quantos textos a busca normalizou, sem depender de como
// ela e montada por dentro.
function countNormalizations() {
  normalizations = 0;
  String.prototype.normalize = function normalize(form) {
    if (form === 'NFD') {
      normalizations += 1;
    }

    return originalNormalize.call(this, form);
  };
}

function stopCounting() {
  String.prototype.normalize = originalNormalize;
}

async function render(overrides = {}) {
  current = { ...current, ...overrides };

  await act(async () => {
    root.render(<ProductList {...current} />);
  });
}

function input() {
  return container.querySelector('#product-search');
}

// Digita como o navegador: troca o valor do campo e dispara o evento de
// entrada. O React atualiza o campo antes de devolver o controle, e a lista
// segue depois, na transicao.
function key(term) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

  setter.call(input(), term);
  input().dispatchEvent(new Event('input', { bubbles: true }));
}

async function typeSearch(term) {
  await act(async () => {
    key(term);
  });
}

function tableNames() {
  return Array.from(container.querySelectorAll('tbody tr'), (row) =>
    row.querySelector('td:nth-child(2) p').textContent,
  );
}

function searchHint() {
  return input().closest('div').parentElement.textContent;
}

function position() {
  return container.querySelector('[data-list-pager] p')?.textContent ?? null;
}

function button(label) {
  return Array.from(container.querySelectorAll('button')).find(
    (element) => element.getAttribute('aria-label') === label || element.textContent.trim() === label,
  );
}

// Sem `act`, o trabalho que o React deixa para depois (a transicao) roda no
// agendador dele, como no navegador. A espera devolve o controle ate a lista
// alcancar o que foi digitado.
async function settle(condition) {
  await vi.waitFor(() => {
    expect(condition()).toBe(true);
  }, { timeout: 10_000, interval: 5 });
}

// O clique e um evento discreto: o React desenha o que ele pediu numa
// microtarefa, antes de o navegador pintar e antes de qualquer transicao, que
// so roda numa tarefa seguinte do agendador.
async function urgentWork() {
  await Promise.resolve();
  await Promise.resolve();
}

function poltrona(index, displayName) {
  return { ...inventProduct(index), displayName };
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
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  stopCounting();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe('normalizacao feita uma vez por catalogo', () => {
  it('com 19.000 produtos, uma sequencia de teclas normaliza so o termo de cada tecla', async () => {
    const products = inventCatalog(19_000);

    countNormalizations();
    await render({ products });
    const onMount = normalizations;

    expect(onMount).toBeGreaterThanOrEqual(products.length);

    const keys = ['g', 'ge', 'gel', 'gela', 'gelad', 'gelade', 'geladei', 'geladeir', 'geladeira', 'geladeir'];

    countNormalizations();

    for (const term of keys) {
      await typeSearch(term);
    }

    stopCounting();

    expect(normalizations).toBeLessThanOrEqual(keys.length);
    expect(tableNames().length).toBeGreaterThan(0);
    expect(tableNames().every((name) => name.startsWith('Geladeira'))).toBe(true);
  });

  it('cadastro, edicao, remocao e importacao refazem a busca sobre a lista nova', async () => {
    const base = inventCatalog(120);

    await render({ products: base });
    await typeSearch('poltrona');

    expect(container.textContent).toContain('Nenhum produto encontrado');

    const nova = poltrona(5000, 'Poltrona reclinável 77777');
    await render({ products: [...base, nova] });

    expect(tableNames()).toEqual(['Poltrona reclinável 77777']);
    expect(searchHint()).toContain('1 de 121');

    const editada = { ...nova, displayName: 'Poltrona giratória 77777' };
    await render({ products: [...base, editada] });

    expect(tableNames()).toEqual(['Poltrona giratória 77777']);

    await typeSearch('GIRATORIA');
    expect(tableNames()).toEqual(['Poltrona giratória 77777']);

    await typeSearch('reclinavel');
    expect(container.textContent).toContain('Nenhum produto encontrado');

    await typeSearch('poltrona');
    await render({ products: base });

    expect(container.textContent).toContain('Nenhum produto encontrado');
    expect(tableNames()).toEqual([]);

    const importados = [...inventCatalog(200, 1000), poltrona(6000, 'Poltrona do papai 88888')];
    await render({ products: [...base, ...importados] });

    expect(tableNames()).toEqual(['Poltrona do papai 88888']);
    expect(searchHint()).toContain('1 de 321');
  });
});

describe('o campo na hora e a lista na transicao', () => {
  it('teclas rapidas mostram cada letra no campo na hora e aplicam o termo uma vez', async () => {
    await render({ products: inventCatalog(300) });

    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    countNormalizations();

    const keys = ['g', 'ge', 'gel', 'gela', 'gelad', 'gelade'];

    for (const term of keys) {
      key(term);
      expect(input().value).toBe(term);
    }

    expect(searchHint()).toContain('300 produtos');

    await settle(() => tableNames().length > 0 && tableNames().every((name) => name.startsWith('Geladeira')));
    stopCounting();

    expect(input().value).toBe('gelade');
    expect(searchHint()).toContain('30 de 300');
    expect(normalizations).toBe(1);
  });

  it('a dica e o aviso falam do termo aplicado, o mesmo da lista na tela', async () => {
    await render({ products: inventCatalog(300) });
    await typeSearch('poltrona');

    expect(container.textContent).toContain('Nada corresponde a poltrona no nome nem nos códigos.');

    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    key('poltronas');

    expect(input().value).toBe('poltronas');
    expect(container.textContent).toContain('Nada corresponde a poltrona no nome nem nos códigos.');
    expect(searchHint()).toContain('0 de 300');

    await settle(() => container.textContent.includes('Nada corresponde a poltronas'));

    key('sofa');

    expect(container.textContent).toContain('Nada corresponde a poltronas');

    await settle(() => tableNames().length > 0);

    expect(container.textContent).not.toContain('Nenhum produto encontrado');
    expect(searchHint()).toContain('30 de 300');
  });

  it('limpar pelo campo aplica na hora e devolve o foco ao campo', async () => {
    await render({ products: inventCatalog(120) });
    await typeSearch('poltrona');

    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    button('Limpar busca').click();
    await urgentWork();

    expect(input().value).toBe('');
    expect(document.activeElement).toBe(input());
    expect(tableNames()).toHaveLength(50);
    expect(searchHint()).toContain('120 produtos');
    expect(position()).toBe('Página 1 de 3 · 1–50');
  });

  it('limpar pelo aviso de busca sem resultado tambem aplica na hora', async () => {
    await render({ products: inventCatalog(120) });
    await typeSearch('poltrona');

    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    const aviso = Array.from(container.querySelectorAll('button')).find(
      (element) => element.textContent.trim() === 'Limpar busca' && !element.getAttribute('aria-label'),
    );
    aviso.click();
    await urgentWork();

    expect(input().value).toBe('');
    expect(tableNames()).toHaveLength(50);
    expect(position()).toBe('Página 1 de 3 · 1–50');
  });

  it('volta a primeira pagina na tecla digitada, antes de o termo ser aplicado', async () => {
    await render({ products: inventCatalog(300) });
    await act(async () => {
      button('Próxima: ir para a próxima página').click();
    });
    await act(async () => {
      button('Próxima: ir para a próxima página').click();
    });

    expect(position()).toBe('Página 3 de 6 · 101–150');

    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    key('o');

    expect(position()).toBe('Página 1 de 6 · 1–50');

    await settle(() => searchHint().includes(' de 300'));

    expect(position()).toMatch(/^Página 1 de /);
  });
});

describe('estados de hoje', () => {
  it('carregando, falha de leitura e catalogo vazio continuam sem campo de busca', async () => {
    await render({ isLoading: true });
    expect(container.textContent).toContain('Carregando produtos');
    expect(input()).toBeNull();

    await render({ isLoading: false, loadError: 'O armazenamento não respondeu.' });
    expect(container.textContent).toContain('Falha ao ler os produtos salvos');
    expect(input()).toBeNull();

    await render({ loadError: null, products: [] });
    expect(container.textContent).toContain('Nenhum produto cadastrado');
    expect(input()).toBeNull();
  });

  it('busca sem resultado mostra o aviso no lugar da lista, sem controle de pagina', async () => {
    await render({ products: inventCatalog(120) });
    await typeSearch('POLTRONA INEXISTENTE');

    expect(container.textContent).toContain('Nenhum produto encontrado');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(position()).toBeNull();
    expect(searchHint()).toContain('0 de 120');
  });
});
