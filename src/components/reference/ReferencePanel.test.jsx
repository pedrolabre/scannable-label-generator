// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O dialogo da base de referencia: o que a base guarda, a base vazia, a troca
 * pela planilha, o apagar e as falhas do armazenamento com o motivo na tela.
 * O `Blob` do jsdom nao monta a planilha, entao a leitura dela entra pronta no
 * store; a leitura em si e coberta no teste do store.
 */

const products = vi.hoisted(() => ({
  clearAllProducts: vi.fn(),
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listProducts: vi.fn(),
  replaceAllProducts: vi.fn(),
  runProductsTransaction: vi.fn(),
  updateProduct: vi.fn(),
  updateProducts: vi.fn(),
}));

const references = vi.hoisted(() => ({
  clearReferenceEntries: vi.fn(),
  findReference: vi.fn(),
  findReferences: vi.fn(),
  getReferenceStats: vi.fn(),
  replaceReferenceEntries: vi.fn(),
}));

vi.mock('../../storage/productRepository.js', () => products);
vi.mock('../../storage/referenceRepository.js', () => references);

const { SHEET_STATUS, useReferenceStore } = await import('../../store/useReferenceStore.js');
const { default: ReferencePanel } = await import('./ReferencePanel.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LOADED = { total: 18931, withNcm: 18930, withEan: 2595, loadedAt: '2026-09-30T15:00:00.000Z' };
const EMPTY = { total: 0, withNcm: 0, withEan: 0, loadedAt: null };

const SHEET = {
  entries: [
    { comparableCode: '1620', systemCode: '1620', ncm: '94035000', ean: '7890000000017' },
    { comparableCode: '118114', systemCode: '118114', ncm: '73211100' },
  ],
  summary: {
    recordCount: 3,
    entryCount: 2,
    withNcm: 2,
    withEan: 1,
    invalidNcm: 1,
    invalidEan: 0,
    unusable: 1,
    repeated: 0,
  },
};

let container;
let root;

async function render() {
  await act(async () => {
    root.render(<ReferencePanel onClose={vi.fn()} />);
  });
}

function dialogs() {
  return Array.from(document.querySelectorAll('[role="dialog"]'));
}

function confirmDialog() {
  return dialogs().find((dialog) => dialog.querySelector('h2').textContent === 'Apagar a base de referência');
}

function button(name, scope = document) {
  return Array.from(scope.querySelectorAll('button')).find((item) => item.textContent.trim() === name);
}

async function click(target) {
  expect(target).toBeTruthy();

  await act(async () => {
    target.click();
  });
}

function stats() {
  const list = container.querySelector('[data-estatisticas-base]');

  return list
    ? Object.fromEntries(
        Array.from(list.querySelectorAll('div')).map((line) => [
          line.querySelector('dt').textContent,
          line.querySelector('dd').textContent,
        ]),
      )
    : null;
}

function storageFailure(name) {
  const error = new Error('falha inventada');
  error.name = name;
  return error;
}

function writesToCatalog() {
  return Object.values(products)
    .filter((fn) => fn !== products.listProducts)
    .reduce((sum, fn) => sum + fn.mock.calls.length, 0);
}

beforeEach(() => {
  vi.clearAllMocks();
  useReferenceStore.setState({ stats: null, isLoadingStats: false, statsError: null });
  useReferenceStore.getState().resetSheet();
  useReferenceStore.getState().resetCompletion();
  references.getReferenceStats.mockResolvedValue(LOADED);
  references.replaceReferenceEntries.mockImplementation(async (entries) => entries.length);
  references.clearReferenceEntries.mockResolvedValue(undefined);

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('o que a base guarda', () => {
  it('mostra o total, os com NCM, os com codigo de barras e a data da ultima carga', async () => {
    await render();

    const lines = stats();

    expect(references.getReferenceStats).toHaveBeenCalledTimes(1);
    expect(lines['Códigos na base']).toBe('18.931');
    expect(lines['Com NCM']).toBe('18.930');
    expect(lines['Com código de barras']).toBe('2.595');
    expect(lines['Última carga']).toContain('30/09/2026');
  });

  it('diz que a base esta vazia e como carrega-la, sem oferecer apagar nem conferir', async () => {
    references.getReferenceStats.mockResolvedValue(EMPTY);

    await render();

    expect(stats()).toBeNull();
    expect(container.querySelector('[data-base-vazia]').textContent).toContain(
      'A base de referência está vazia',
    );
    expect(container.querySelector('[data-base-vazia]').textContent).toContain('planilha cadastral .ods');
    expect(container.querySelector('[data-apagar-base]')).toBeNull();
    expect(button('Conferir o catálogo', container).disabled).toBe(true);
  });

  it('mostra o motivo quando a leitura da base falha, e tenta de novo', async () => {
    references.getReferenceStats.mockRejectedValueOnce(storageFailure('InvalidStateError'));

    await render();

    expect(container.querySelector('[role="alert"]').textContent).toContain(
      'Este navegador está bloqueando o armazenamento local.',
    );
    expect(stats()).toBeNull();

    await click(button('Tentar de novo', container));

    expect(stats()['Códigos na base']).toBe('18.931');
  });
});

describe('troca pela planilha', () => {
  beforeEach(() => {
    useReferenceStore.setState({ sheetStatus: SHEET_STATUS.READY, sheetReference: SHEET });
  });

  it('troca a base inteira na confirmacao, sem escrever em produto, e relê a base', async () => {
    await render();

    expect(container.querySelector('[data-resumo-base-referencia]').textContent).toContain(
      '2 códigos da planilha substituem a base guardada neste navegador',
    );

    references.getReferenceStats.mockResolvedValue({ ...LOADED, total: 2, withNcm: 2, withEan: 1 });

    await click(button('Trocar a base de referência', container));

    expect(references.replaceReferenceEntries).toHaveBeenCalledWith(SHEET.entries);
    expect(container.querySelector('[data-resumo-base-referencia]').textContent).toContain(
      'Base de referência guardada com 2 códigos.',
    );
    expect(stats()['Códigos na base']).toBe('2');
    expect(writesToCatalog()).toBe(0);
    expect(products.listProducts).not.toHaveBeenCalled();
  });

  it('mostra o motivo quando a gravacao da base falha e deixa tentar de novo', async () => {
    references.replaceReferenceEntries.mockRejectedValueOnce(storageFailure('QuotaExceededError'));

    await render();
    await click(button('Trocar a base de referência', container));

    expect(container.querySelector('[role="alert"]').textContent).toContain(
      'O armazenamento deste dispositivo está cheio.',
    );
    expect(button('Trocar a base de referência', container).disabled).toBe(false);
    expect(stats()['Códigos na base']).toBe('18.931');
  });
});

describe('apagar a base', () => {
  it('pede confirmacao com o total e apaga sem tocar o catalogo', async () => {
    await render();
    await click(container.querySelector('[data-apagar-base]'));

    const confirm = confirmDialog();

    expect(confirm.textContent).toContain('18.931 códigos');
    expect(confirm.textContent).toContain('O catálogo fica como está.');

    references.getReferenceStats.mockResolvedValue(EMPTY);

    await click(button('Apagar a base', confirm));

    expect(references.clearReferenceEntries).toHaveBeenCalledTimes(1);
    expect(writesToCatalog()).toBe(0);
    expect(dialogs()).toHaveLength(1);
    expect(container.querySelector('[data-base-vazia]')).not.toBeNull();
  });

  it('mantem a confirmacao aberta com o motivo quando apagar falha', async () => {
    references.clearReferenceEntries.mockRejectedValueOnce(storageFailure('AbortError'));

    await render();
    await click(container.querySelector('[data-apagar-base]'));

    const confirm = confirmDialog();

    await click(button('Apagar a base', confirm));

    expect(confirm.querySelector('[role="alert"]').textContent).toContain(
      'A gravação foi interrompida antes de terminar.',
    );
    expect(button('Tentar de novo', confirm)).toBeTruthy();
    expect(stats()['Códigos na base']).toBe('18.931');
  });
});
