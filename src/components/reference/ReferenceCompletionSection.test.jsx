// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Completar o catalogo pela base, na tela: conferir mostra o resumo sem
 * gravar, completar grava so os campos vazios, o NCM diferente vira divergencia
 * revisada a parte, e a falha fica na tela com o motivo. Os dois repositorios
 * entram como duble.
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

const { useReferenceStore } = await import('../../store/useReferenceStore.js');
const { useProductStore } = await import('../../store/useProductStore.js');
const { default: ReferenceCompletionSection } = await import('./ReferenceCompletionSection.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function product(fields) {
  return {
    id: `id-${fields.systemCode}`,
    priceInCentavos: 10000,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...fields,
  };
}

const WARDROBE = product({ systemCode: '01620', displayName: 'GUARDA ROUPA INVENTADO 6PTS' });
const STOVE = product({ systemCode: '118114', displayName: 'FOGAO INVENTADO 4 BOCAS', ncm: '73211100' });
const RACK = product({ systemCode: '5001', displayName: 'RACK INVENTADO' });
const SOFA = product({
  systemCode: '2040',
  displayName: 'SOFA INVENTADO',
  ncm: '94016100',
  ean: '7890000000031',
});

const BASE = new Map([
  ['01620', { systemCode: '1620', ncm: '94035000', ean: '7890000000017' }],
  ['118114', { systemCode: '118114', ncm: '73211100', ean: '7890000000024' }],
]);

let container;
let root;

async function render(props = {}) {
  await act(async () => {
    root.render(<ReferenceCompletionSection isBaseEmpty={false} {...props} />);
  });
}

function button(name) {
  return Array.from(container.querySelectorAll('button')).find((item) => item.textContent.trim() === name);
}

async function click(name) {
  const target = button(name);

  expect(target, `botão "${name}" não encontrado`).toBeTruthy();

  await act(async () => {
    target.click();
  });
}

function summaryLines() {
  return Object.fromEntries(
    Array.from(container.querySelectorAll('[data-resumo-completar-base] dl > div')).map((line) => [
      line.querySelector('dt').textContent,
      line.querySelector('dd').textContent,
    ]),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useReferenceStore.getState().resetCompletion();
  useProductStore.setState({ products: [], isLoading: false, loadError: null });
  products.listProducts.mockResolvedValue([WARDROBE, STOVE, RACK, SOFA]);
  products.updateProducts.mockImplementation(async (list) => list);
  references.findReferences.mockImplementation(
    async (codes) => new Map(codes.filter((code) => BASE.has(code)).map((code) => [code, BASE.get(code)])),
  );

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

describe('completar o catalogo pela base', () => {
  it('confere e mostra o resumo, sem gravar', async () => {
    await render();
    await click('Conferir o catálogo');

    expect(container.querySelector('[data-resumo-completar-base] [role="status"]').textContent).toBe(
      '2 produtos ganham dados da base. Nada foi gravado ainda.',
    );
    expect(summaryLines()).toEqual({
      'Produtos sem NCM ou sem código de barras': '3',
      'Ganham NCM': '1',
      'Ganham código de barras': '2',
      'Códigos fora da base': '1',
    });
    expect(products.updateProducts).not.toHaveBeenCalled();
  });

  it('completa so os campos vazios na confirmacao', async () => {
    await render();
    await click('Conferir o catálogo');
    await click('Completar catálogo');

    const written = products.updateProducts.mock.calls[0][0];

    expect(written.map((item) => [item.systemCode, item.ncm, item.ean])).toEqual([
      ['01620', '94035000', '7890000000017'],
      ['118114', '73211100', '7890000000024'],
    ]);
    expect(container.querySelector('[data-resumo-completar-base] [role="status"]').textContent).toBe(
      '2 produtos completados.',
    );
    expect(button('Completar catálogo')).toBeUndefined();
    expect(products.createProduct).not.toHaveBeenCalled();
  });

  it('mostra o motivo quando a gravacao falha, com o resumo ainda na tela', async () => {
    const error = new Error('falha inventada');
    error.name = 'QuotaExceededError';
    products.updateProducts.mockRejectedValueOnce(error);

    await render();
    await click('Conferir o catálogo');
    await click('Completar catálogo');

    expect(container.querySelector('[role="alert"]').textContent).toContain(
      'O armazenamento deste dispositivo está cheio.',
    );
    expect(button('Completar catálogo').disabled).toBe(false);
    expect(summaryLines()['Ganham NCM']).toBe('1');
  });

  it('nao oferece completar quando nenhum produto ganha campo', async () => {
    products.listProducts.mockResolvedValue([SOFA]);

    await render();
    await click('Conferir o catálogo');

    expect(container.querySelector('[data-resumo-completar-base] [role="status"]').textContent).toBe(
      'Nenhum produto do catálogo está sem NCM ou sem código de barras.',
    );
    expect(button('Completar catálogo')).toBeUndefined();
    expect(button('Divergências (0)')).toBeUndefined();
    expect(references.findReferences).toHaveBeenCalledWith(['2040']);
  });

  it('aponta o NCM diferente e so o muda depois da escolha', async () => {
    const reclassified = product({ ...SOFA, ncm: '94016900' });

    products.listProducts.mockResolvedValue([reclassified]);
    references.findReferences.mockResolvedValue(
      new Map([['2040', { systemCode: '2040', ncm: '94016100', ean: '7890000000031' }]]),
    );

    await render();
    await click('Conferir o catálogo');
    await click('Divergências (1)');

    const dialog = document.querySelector('[data-divergencias]');

    expect(dialog.textContent).toContain('2040');
    expect(dialog.querySelector('[data-valor-cadastrado]').textContent).toBe('94016900');
    expect(dialog.querySelector('[data-valor-novo]').textContent).toBe('94016100');
    expect(dialog.textContent).toContain('Na base');
    expect(button('Aplicar escolhas').disabled).toBe(true);

    await act(async () => {
      dialog.querySelector('input[value="change"]').click();
    });

    products.listProducts.mockResolvedValue([reclassified]);

    await click('Aplicar escolhas');

    expect(products.updateProducts).toHaveBeenCalledTimes(1);
    expect(products.updateProducts.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: reclassified.id, ncm: '94016100', displayName: 'SOFA INVENTADO' }),
    ]);
    expect(container.textContent).toContain('1 produto atualizado.');
  });

  it('deixa conferir indisponivel com a base vazia', async () => {
    await render({ isBaseEmpty: true });

    expect(button('Conferir o catálogo').disabled).toBe(true);
  });
});
