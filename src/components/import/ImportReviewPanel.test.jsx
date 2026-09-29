// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bytesOf, footer, priceHeader, priceRow } from '../../domain/services/txtReportFixtures.js';

/**
 * A revisao do lote depois do enriquecimento, com o lote passando de verdade
 * pela leitura, pela base, pela conferencia e pela deteccao de codigo
 * repetido. Os dois repositorios entram como duble. O que se prova e o que a
 * tela mostra: a frase dos completados, a marca nos registros que aparecem na
 * revisao e o aviso da base que falhou, com a gravacao ainda disponivel.
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

const { useImportStore } = await import('../../store/useImportStore.js');
const { default: ImportReviewPanel } = await import('./ImportReviewPanel.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function stored(systemCode, displayName, priceInCentavos) {
  return {
    id: `11111111-1111-4111-8111-11111111${systemCode.padStart(4, '0').slice(-4)}`,
    systemCode,
    displayName,
    priceInCentavos,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  };
}

// No catalogo com outro preco, o guarda-roupa e a poltrona voltam como codigo
// repetido e aparecem na revisao; o fogao e novo e chega pronto.
const CATALOG = [
  stored('01620', 'GUARDA ROUPA INVENTADO 6PTS', 99900),
  stored('777777', 'POLTRONA INVENTADA', 39900),
];

const PRICE_REPORT = bytesOf([
  ...priceHeader(1),
  priceRow({ code: '01620', description: 'GUARDA ROUPA INVENTADO 6PTS', price: '1.299,90' }),
  priceRow({ code: '118114', description: 'FOGAO INVENTADO 4 BOCAS', price: '899,00' }),
  priceRow({ code: '777777', description: 'POLTRONA INVENTADA', price: '450,00' }),
  ...footer(3),
]);

function baseLookup(codes) {
  const known = new Map([
    ['1620', { systemCode: '1620', ncm: '94035000', ean: '7890000000017' }],
    ['118114', { systemCode: '118114', ncm: '73211100' }],
  ]);

  return new Map(
    codes
      .filter((code) => known.has(code.replace(/^0+(?=\d)/, '')))
      .map((code) => [code, known.get(code.replace(/^0+(?=\d)/, ''))]),
  );
}

let container;
let root;

async function importAndRender() {
  await act(async () => {
    await useImportStore.getState().parseFiles([new File([PRICE_REPORT], 'tabela-inventada.txt')]);
  });

  await act(async () => {
    root.render(<ImportReviewPanel />);
  });
}

function rowOf(code) {
  const rows = container.querySelectorAll('[aria-label="Registros para revisão"] > li');

  return Array.from(rows).find((row) => row.textContent.includes(code));
}

function writeButton() {
  return Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent.startsWith('Gravar'),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useImportStore.getState().reset();
  products.listProducts.mockResolvedValue(CATALOG);
  references.findReferences.mockImplementation(async (codes) => baseLookup(codes));

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

describe('retorno do enriquecimento na revisao', () => {
  it('conta os completados por campo e os fora da base, prontos inclusive', async () => {
    await importAndRender();

    expect(container.querySelector('[data-resumo-enriquecimento]').textContent).toBe(
      'Completados pela base de referência: 2 com NCM e 1 com código de barras. 1 registro com código fora da base.',
    );
    expect(rowOf('118114')).toBeUndefined();
  });

  it('marca os campos que vieram da base no registro da revisao, e so nele', async () => {
    await importAndRender();

    const wardrobe = rowOf('01620');
    const armchair = rowOf('777777');

    expect(wardrobe.querySelector('[data-completado-pela-base]').textContent).toBe(
      'Da base: NCM e código de barras',
    );
    expect(wardrobe.querySelector('[data-completado-pela-base]').dataset.completadoPelaBase).toBe(
      'ncm ean',
    );
    expect(armchair).toBeDefined();
    expect(armchair.querySelector('[data-completado-pela-base]')).toBeNull();
  });

  it('fica como antes com a base vazia: sem frase e sem marca', async () => {
    references.findReferences.mockResolvedValue(new Map());

    await importAndRender();

    expect(container.querySelector('[data-resumo-enriquecimento]')).toBeNull();
    expect(container.querySelector('[data-completado-pela-base]')).toBeNull();
    expect(container.querySelector('[data-falha-base]')).toBeNull();
  });

  it('avisa a falha de leitura da base e deixa a gravacao disponivel', async () => {
    const error = new Error('falha inventada');
    error.name = 'UnknownError';
    references.findReferences.mockRejectedValue(error);

    await importAndRender();

    expect(container.querySelector('[data-falha-base]').textContent).toContain(
      'O armazenamento deste dispositivo não respondeu à leitura.',
    );
    expect(container.querySelector('[data-resumo-enriquecimento]')).toBeNull();
    expect(container.querySelector('[data-completado-pela-base]')).toBeNull();
    expect(writeButton().textContent).toBe('Gravar 1 registro no catálogo');
    expect(writeButton().disabled).toBe(false);
  });
});
