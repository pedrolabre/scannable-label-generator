// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bytesOf,
  footer,
  stockHeader,
  stockRow,
} from '../../domain/services/txtReportFixtures.js';
import { useCompletionStore } from '../../store/useCompletionStore.js';
import ImportFilePicker from '../import/ImportFilePicker.jsx';

import CatalogCompletionPanel from './CatalogCompletionPanel.jsx';

/**
 * A tela da complementacao: o seletor com a sua lista e a sua ajuda, o resumo
 * antes de gravar e a gravacao so depois do clique. O repositorio entra como
 * duble.
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

const WARDROBE = Object.freeze({
  id: '11111111-1111-4111-8111-111111111111',
  systemCode: '1620',
  displayName: 'GUARDA ROUPA INVENTADO',
  description: 'GUARDA ROUPA INVENTADO 6PTS',
  priceInCentavos: 129990,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
});

const STOCK_REPORT = bytesOf([
  ...stockHeader(1),
  'Grupo: 21-MOVEIS',
  stockRow({ code: '001620', description: 'GUARDA ROUPA INVENTADO 6PTS' }),
  stockRow({ code: '777777', description: 'CAMA INVENTADA' }),
  ...footer(2),
]);

let container;
let root;

function render(ui) {
  act(() => {
    root.render(ui);
  });
}

function botao(nome) {
  return Array.from(container.querySelectorAll('button')).find(
    (elemento) => elemento.textContent.trim() === nome,
  );
}

async function clicar(nome) {
  await act(async () => {
    botao(nome).click();
  });
}

async function escolher(nome, conteudo) {
  const campo = container.querySelector('#completion-files');
  const arquivo = new File([conteudo], nome, { type: 'text/plain' });

  Object.defineProperty(campo, 'files', { value: [arquivo], configurable: true });

  await act(async () => {
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function texto() {
  return container.textContent.replace(/\s+/g, ' ');
}

beforeEach(() => {
  vi.clearAllMocks();
  useCompletionStore.getState().reset();
  repository.listProducts.mockResolvedValue([WARDROBE]);
  repository.updateProducts.mockImplementation(async (products) => products);

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

describe('seletor de arquivos', () => {
  it('aceita a planilha .ods e os formatos da importacao, com ajuda propria', () => {
    render(<CatalogCompletionPanel onClose={vi.fn()} />);

    const campo = container.querySelector('#completion-files');

    expect(campo.getAttribute('accept')).toBe('.csv,.json,.xml,.txt,.ods');
    expect(texto()).toContain(
      'Aceita a planilha .ods e os mesmos arquivos da importação. Só preenche campos vazios dos produtos já cadastrados; nenhum produto é criado.',
    );
  });

  it('deixa a importacao de produtos sem o .ods e cita o relatorio do ERP na ajuda', () => {
    render(<ImportFilePicker isParsing={false} onFilesSelected={vi.fn()} />);

    const campo = container.querySelector('#import-files');

    expect(campo.getAttribute('accept')).toBe('.csv,.json,.xml,.txt');
    expect(texto()).toContain(
      'Aceita planilhas .csv, listas .json, notas fiscais .xml e relatórios .txt do ERP. Vários arquivos de uma vez.',
    );
  });
});

describe('resumo e gravacao', () => {
  it('mostra as contagens antes de gravar e nao grava nada sem o clique', async () => {
    render(<CatalogCompletionPanel onClose={vi.fn()} />);

    await escolher('saldo.TXT', STOCK_REPORT);

    expect(texto()).toContain('1 produto ganha dados. Nada foi gravado ainda.');
    expect(texto()).toContain('Produtos que ganham algum campo1');
    expect(texto()).toContain('Códigos fora do catálogo1');
    expect(texto()).toContain('Categoria: 1 a preencher');
    expect(texto()).toContain('Descrição: 0 a preencher, 1 já preenchido');
    expect(repository.updateProducts).not.toHaveBeenCalled();
  });

  it('grava so depois da confirmacao e mostra o resultado', async () => {
    render(<CatalogCompletionPanel onClose={vi.fn()} />);

    await escolher('saldo.TXT', STOCK_REPORT);
    await clicar('Completar catálogo');

    expect(repository.updateProducts).toHaveBeenCalledTimes(1);
    expect(repository.updateProducts.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: WARDROBE.id, category: '21-MOVEIS' }),
    ]);
    expect(texto()).toContain('1 produto completado.');
    expect(botao('Completar catálogo')).toBeUndefined();
  });

  it('mantem o resumo e o botao quando a gravacao falha', async () => {
    repository.updateProducts.mockRejectedValueOnce(new Error('falha'));

    render(<CatalogCompletionPanel onClose={vi.fn()} />);

    await escolher('saldo.TXT', STOCK_REPORT);
    await clicar('Completar catálogo');

    expect(container.querySelector('[role="alert"]').textContent).toContain(
      'Não foi possível gravar no armazenamento deste dispositivo. Tente de novo.',
    );
    expect(botao('Completar catálogo')).toBeDefined();
    expect(texto()).not.toContain('produto completado');
  });

  it('nao oferece gravacao quando nenhum produto ganha campo', async () => {
    repository.listProducts.mockResolvedValue([{ ...WARDROBE, category: '21-MOVEIS' }]);

    render(<CatalogCompletionPanel onClose={vi.fn()} />);

    await escolher('saldo.TXT', STOCK_REPORT);

    expect(texto()).toContain('Nenhum produto do catálogo tem campo vazio que estes arquivos preencham.');
    expect(botao('Completar catálogo')).toBeUndefined();
  });

  it('mostra a recusa do arquivo com a frase do leitor', async () => {
    render(<CatalogCompletionPanel onClose={vi.fn()} />);

    await escolher('anotacoes.txt', 'nada de relatorio aqui');

    expect(texto()).toContain('Relatório em texto não reconhecido');
    expect(repository.updateProducts).not.toHaveBeenCalled();
  });
});
