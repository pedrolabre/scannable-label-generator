// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O gatilho da base de referencia no cabecalho e o dialogo que ele abre, no
 * mesmo padrao dos outros dialogos: titulo, foco no botao de fechar, um
 * dialogo por vez e o foco de volta ao gatilho quando ele fecha.
 */

const generateSymbol = vi.hoisted(() => vi.fn());

const references = vi.hoisted(() => ({
  clearReferenceEntries: vi.fn(),
  findReference: vi.fn(),
  findReferences: vi.fn(),
  getReferenceStats: vi.fn(),
  replaceReferenceEntries: vi.fn(),
}));

vi.mock('./lib/barcode.js', () => ({ generateSymbol }));
vi.mock('./storage/referenceRepository.js', () => references);

const { default: App } = await import('./App.jsx');
const { useProductStore } = await import('./store/useProductStore.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let estadoInicialDoCatalogo;

async function render() {
  await act(async () => {
    root.render(<App />);
  });
}

function botao(nome) {
  return Array.from(container.querySelectorAll('button')).find(
    (elemento) =>
      elemento.textContent.trim() === nome || elemento.getAttribute('aria-label') === nome,
  );
}

async function clicar(nome) {
  const alvo = botao(nome);

  expect(alvo, `botão "${nome}" não encontrado`).toBeTruthy();

  await act(async () => {
    alvo.focus();
    alvo.click();
  });
}

function dialogos() {
  return container.querySelectorAll('[role="dialog"]');
}

function tituloDoDialogo() {
  const dialogo = container.querySelector('[role="dialog"]');

  return dialogo ? dialogo.querySelector('h2').textContent : null;
}

beforeEach(() => {
  estadoInicialDoCatalogo = useProductStore.getState();
  references.getReferenceStats.mockResolvedValue({ total: 0, withNcm: 0, withEan: 0, loadedAt: null });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();

  useProductStore.setState(estadoInicialDoCatalogo, true);
  generateSymbol.mockReset();
  vi.clearAllMocks();
});

describe('base de referencia pelo cabecalho', () => {
  it('fica logo depois de Completar dados e abre o dialogo com o foco no botao de fechar', async () => {
    await render();

    const nomes = Array.from(container.querySelectorAll('[data-gatilhos] button')).map((b) =>
      b.textContent.trim(),
    );

    expect(nomes.indexOf('Base de referência')).toBe(nomes.indexOf('Completar dados') + 1);

    await clicar('Base de referência');

    expect(tituloDoDialogo()).toBe('Base de referência');
    expect(document.activeElement.getAttribute('aria-label')).toBe('Fechar');
    expect(references.getReferenceStats).toHaveBeenCalledTimes(1);
  });

  it('abre um dialogo por vez e devolve o foco ao gatilho quando fecha', async () => {
    await render();
    await clicar('Base de referência');

    expect(dialogos()).toHaveLength(1);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(dialogos()).toHaveLength(0);
    expect(document.activeElement).toBe(botao('Base de referência'));

    await clicar('Completar dados');
    expect(dialogos()).toHaveLength(1);
    expect(tituloDoDialogo()).toBe('Completar dados');
  });
});
