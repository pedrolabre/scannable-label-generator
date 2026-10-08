// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O dialogo da base de referencia: o que a base guarda, a base vazia, a carga
 * por arquivo — atualizar ou trocar —, o apagar e as falhas do armazenamento
 * com o motivo na tela.
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
  mergeReferenceEntries: vi.fn(),
  previewReferenceLoad: vi.fn(),
  replaceReferenceBase: vi.fn(),
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
  preview: { added: 1, updated: 0, unchanged: 1, removedOnReplace: 18929 },
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
    expect(container.querySelector('[data-base-vazia]').textContent).toContain(
      'Carregue um arquivo aqui ou pelo Completar dados',
    );
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

describe('carga por arquivo', () => {
  beforeEach(() => {
    useReferenceStore.setState({ sheetStatus: SHEET_STATUS.READY, sheetReference: SHEET });
  });

  it('atualiza a base codigo por codigo, sem escrever em produto, e relê a base', async () => {
    await render();

    const resumo = () => container.querySelector('[data-resumo-base-referencia]').textContent;

    expect(resumo()).toContain('2 códigos do arquivo vão para a base');
    expect(resumo()).toContain('1 novo · 0 atualizados · 1 igual');

    references.mergeReferenceEntries.mockResolvedValue({ added: 1, updated: 0, unchanged: 1 });
    references.getReferenceStats.mockResolvedValue({ ...LOADED, total: 18932 });

    await click(button('Atualizar a base', container));

    expect(references.mergeReferenceEntries).toHaveBeenCalledWith(SHEET.entries);
    expect(references.replaceReferenceBase).not.toHaveBeenCalled();
    expect(resumo()).toContain('Base de referência atualizada: 1 novo · 0 atualizados · 1 igual.');
    expect(stats()['Códigos na base']).toBe('18.932');
    expect(writesToCatalog()).toBe(0);
    expect(products.listProducts).not.toHaveBeenCalled();
  });

  it('troca a base inteira so depois de confirmar quantos codigos saem', async () => {
    await render();
    await click(button('Trocar a base', container));

    const confirm = dialogs().find(
      (dialog) => dialog.querySelector('h2').textContent === 'Trocar a base de referência',
    );

    expect(confirm.textContent).toContain('2 códigos do arquivo ficam na base.');
    expect(confirm.textContent).toContain('18.929 códigos que não estão no arquivo saem da base.');
    expect(references.replaceReferenceBase).not.toHaveBeenCalled();

    references.replaceReferenceBase.mockResolvedValue({ entryCount: 2, removed: 18929 });
    references.getReferenceStats.mockResolvedValue({ ...LOADED, total: 2, withNcm: 2, withEan: 1 });

    await click(button('Trocar a base', confirm));

    expect(references.replaceReferenceBase).toHaveBeenCalledWith(SHEET.entries);
    expect(dialogs()).toHaveLength(1);
    expect(container.querySelector('[data-resumo-base-referencia]').textContent).toContain(
      'Base de referência trocada: 2 códigos guardados · 18.929 removidos.',
    );
    expect(stats()['Códigos na base']).toBe('2');
    expect(writesToCatalog()).toBe(0);
  });

  it('cancelar a troca nao grava nada', async () => {
    await render();
    await click(button('Trocar a base', container));

    const confirm = dialogs().find(
      (dialog) => dialog.querySelector('h2').textContent === 'Trocar a base de referência',
    );

    await click(button('Cancelar', confirm));

    expect(dialogs()).toHaveLength(1);
    expect(references.replaceReferenceBase).not.toHaveBeenCalled();
    expect(references.mergeReferenceEntries).not.toHaveBeenCalled();
  });

  it('mostra o motivo quando a gravacao da base falha e deixa tentar de novo', async () => {
    references.mergeReferenceEntries.mockRejectedValueOnce(storageFailure('QuotaExceededError'));

    await render();
    await click(button('Atualizar a base', container));

    expect(container.querySelector('[role="alert"]').textContent).toContain(
      'O armazenamento deste dispositivo está cheio.',
    );
    expect(button('Atualizar a base', container).disabled).toBe(false);
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
