// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bytesOf, footer, priceHeader, priceRow } from '../../domain/services/txtReportFixtures.js';
import { useCompletionStore } from '../../store/useCompletionStore.js';

import CatalogCompletionPanel from './CatalogCompletionPanel.jsx';

/**
 * As divergencias no Completar dados: o botao no resultado, o segundo dialogo
 * por cima do primeiro, tudo abrindo em Manter, o mudar em lote pelo filtro e a
 * gravacao so do que foi escolhido. A tabela de precos passa pelo leitor de
 * verdade; o repositorio de produtos entra como duble.
 */

const repository = vi.hoisted(() => ({
  clearAllProducts: vi.fn(),
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listProducts: vi.fn(),
  updateProduct: vi.fn(),
  updateProducts: vi.fn(),
}));

vi.mock('../../storage/productRepository.js', () => repository);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function product(id, fields) {
  return {
    id: `11111111-1111-4111-8111-${String(id).padStart(12, '0')}`,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...fields,
  };
}

const WARDROBE = product(1, {
  systemCode: '1620',
  displayName: 'GUARDA ROUPA INVENTADO',
  description: 'GUARDA ROUPA INVENTADO 6PTS',
  priceInCentavos: 129990,
});

const STOVE = product(2, {
  systemCode: '118114',
  displayName: 'FOGAO INVENTADO',
  description: 'FOGAO INVENTADO',
  priceInCentavos: 89990,
});

const PRICE_TABLE = bytesOf([
  ...priceHeader(1),
  priceRow({ code: '001620', description: 'GUARDA ROUPA INVENTADO 6 PORTAS', price: '1.399,90' }),
  priceRow({ code: '118114', description: 'FOGAO INVENTADO', price: '949,90' }),
  ...footer(2),
]);

let container;
let root;

function buttons() {
  return Array.from(document.querySelectorAll('button'));
}

function botao(nome, scope = document) {
  return Array.from(scope.querySelectorAll('button')).find((item) => item.textContent.trim() === nome);
}

async function clicar(alvo) {
  await act(async () => {
    alvo.click();
  });
}

function dialogo() {
  return document.querySelector('[data-divergencias]');
}

async function lerTabela() {
  const campo = container.querySelector('#completion-files');

  Object.defineProperty(campo, 'files', {
    value: [new File([PRICE_TABLE], 'tabela.txt', { type: 'text/plain' })],
    configurable: true,
  });

  await act(async () => {
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useCompletionStore.getState().reset();
  repository.listProducts.mockResolvedValue([WARDROBE, STOVE]);
  repository.updateProducts.mockImplementation(async (products) => products);

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root.render(<CatalogCompletionPanel onClose={vi.fn()} />);
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('divergencias no Completar dados', () => {
  it('mostra o botao com o total e abre a revisao com tudo em Manter', async () => {
    await lerTabela();

    expect(botao('Divergências (3)')).toBeDefined();

    await clicar(botao('Divergências (3)'));

    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);
    expect(dialogo().querySelectorAll('[data-divergencia]')).toHaveLength(3);
    expect(dialogo().querySelectorAll('input[value="keep"]:checked')).toHaveLength(3);
    expect(dialogo().textContent).toContain('R$ 1.299,90');
    expect(dialogo().textContent).toContain('R$ 1.399,90');
    expect(botao('Aplicar escolhas').disabled).toBe(true);
    expect(repository.updateProducts).not.toHaveBeenCalled();
  });

  it('muda todos os precos pelo filtro, sem mudar a descricao, e grava so eles', async () => {
    await lerTabela();
    await clicar(botao('Divergências (3)'));

    await act(async () => {
      dialogo().querySelector('input[name="divergencias-filtro"][value="priceInCentavos"]').click();
    });

    expect(dialogo().querySelectorAll('[data-divergencia]')).toHaveLength(2);

    await clicar(botao('Mudar todos', dialogo()));

    expect(dialogo().querySelector('[data-marcadas]').textContent).toBe('2 itens marcados para mudar.');

    // Depois da gravacao, o catalogo relido ja tem os precos novos.
    repository.listProducts
      .mockResolvedValueOnce([WARDROBE, STOVE])
      .mockResolvedValue([
        { ...WARDROBE, priceInCentavos: 139990 },
        { ...STOVE, priceInCentavos: 94990 },
      ]);

    await clicar(botao('Aplicar escolhas'));

    const written = repository.updateProducts.mock.calls[0][0];

    expect(written.map((item) => [item.systemCode, item.priceInCentavos, item.description])).toEqual([
      ['1620', 139990, 'GUARDA ROUPA INVENTADO 6PTS'],
      ['118114', 94990, 'FOGAO INVENTADO'],
    ]);
    expect(dialogo().textContent).toContain('2 produtos atualizados.');
    expect(dialogo().querySelectorAll('[data-divergencia]')).toHaveLength(1);
    expect(botao('Divergências (1)')).toBeDefined();
  });

  it('fecha so a revisao no Esc, e o Completar dados continua aberto', async () => {
    await lerTabela();
    await clicar(botao('Divergências (3)'));

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(dialogo()).toBeNull();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(buttons().some((item) => item.textContent.trim() === 'Divergências (3)')).toBe(true);
  });
});
