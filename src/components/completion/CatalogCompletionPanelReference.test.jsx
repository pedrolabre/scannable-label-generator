// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COMPLETION_STATUS, useCompletionStore } from '../../store/useCompletionStore.js';

import CatalogCompletionPanel from './CatalogCompletionPanel.jsx';

/**
 * A base de referencia no dialogo do Completar dados: o resumo do arquivo com a
 * previa do que muda na base, o botao que so atualiza a base quando nao ha
 * produto a completar e o resultado depois da gravacao. O `Blob` do jsdom nao monta a planilha, entao o estado da
 * leitura entra pronto no store; a leitura em si e coberta no teste do store.
 */

const products = vi.hoisted(() => ({
  clearAllProducts: vi.fn(),
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listProducts: vi.fn(),
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

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function summary(overrides = {}) {
  const zero = { description: 0, ean: 0, ncm: 0, category: 0, notes: 0 };

  return {
    recordCount: 3,
    updatedProducts: 0,
    alreadyComplete: 0,
    outsideCatalog: 3,
    ambiguousCodes: 0,
    repeatedInFile: 0,
    gainedByField: { ...zero },
    filledByField: { ...zero },
    invalidByField: { ...zero, ncm: 1 },
    ...overrides,
  };
}

const REFERENCE = {
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
  preview: { added: 1, updated: 1, unchanged: 0, removedOnReplace: 0 },
};

let container;
let root;

function render() {
  act(() => {
    root.render(<CatalogCompletionPanel onClose={vi.fn()} />);
  });
}

function botao(nome) {
  return Array.from(container.querySelectorAll('button')).find(
    (elemento) => elemento.textContent.trim() === nome,
  );
}

function texto() {
  return container.textContent.replace(/\s+/g, ' ');
}

function leituraPronta(plan, reference = REFERENCE) {
  useCompletionStore.setState({
    status: COMPLETION_STATUS.READY,
    files: [{ fileIndex: 0, fileName: 'cadastro.ods', format: 'ods', status: 'parsed', recordCount: 3, error: null }],
    records: [],
    plan,
    reference,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useCompletionStore.getState().reset();
  products.listProducts.mockResolvedValue([]);
  products.updateProducts.mockImplementation(async (list) => list);
  references.mergeReferenceEntries.mockResolvedValue({ added: 1, updated: 1, unchanged: 0 });

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

describe('base de referencia no dialogo', () => {
  it('diz o que vai para a base, o que muda nela e o que fica fora, antes de gravar', () => {
    leituraPronta({ products: [], summary: summary() });
    render();

    expect(texto()).toContain('2 códigos do arquivo vão para a base: 2 com NCM e 1 com código de barras.');
    expect(texto()).toContain('1 novo · 1 atualizado · 0 iguais');
    expect(texto()).toContain('Ficam fora: 1 NCM inválido, 1 linha sem dado aproveitável.');
    expect(references.mergeReferenceEntries).not.toHaveBeenCalled();
  });

  it('oferece so atualizar a base quando nenhum produto ganha campo, e mostra o resultado', async () => {
    leituraPronta({ products: [], summary: summary() });
    render();

    expect(botao('Completar catálogo')).toBeUndefined();

    await act(async () => {
      botao('Atualizar a base de referência').click();
    });

    expect(references.mergeReferenceEntries).toHaveBeenCalledWith(REFERENCE.entries);
    expect(references.replaceReferenceEntries).not.toHaveBeenCalled();
    expect(texto()).toContain('Base de referência atualizada: 1 novo · 1 atualizado · 0 iguais.');
    expect(botao('Atualizar a base de referência')).toBeUndefined();
  });

  it('mantem o nome de completar quando ha produto a completar', () => {
    leituraPronta({ products: [], summary: summary({ updatedProducts: 1 }) });
    render();

    expect(botao('Completar catálogo')).toBeDefined();
    expect(botao('Atualizar a base de referência')).toBeUndefined();
  });

  it('nao mostra a base nem oferece gravacao quando o arquivo nao tem linha aproveitavel', () => {
    leituraPronta(
      { products: [], summary: summary() },
      { entries: [], summary: { ...REFERENCE.summary, entryCount: 0, withNcm: 0, withEan: 0, unusable: 3 } },
    );
    render();

    expect(texto()).toContain(
      'O arquivo não tem código com NCM ou código de barras válido; a base guardada fica como está.',
    );
    expect(botao('Atualizar a base de referência')).toBeUndefined();
  });

  it('nao mostra a base quando o lote nao tem arquivo com NCM ou codigo de barras', () => {
    leituraPronta({ products: [], summary: summary() }, null);
    render();

    expect(container.querySelector('[data-resumo-base-referencia]')).toBeNull();
  });
});
