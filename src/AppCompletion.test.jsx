// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { useProductStore } from './store/useProductStore.js';

/**
 * O gatilho da complementacao no cabecalho e o dialogo que ele abre, no mesmo
 * padrao dos outros dialogos: titulo, foco no botao de fechar, um dialogo por
 * vez e o foco de volta ao gatilho quando ele fecha.
 */

const generateSymbol = vi.hoisted(() => vi.fn());

vi.mock('./lib/barcode.js', () => ({ generateSymbol }));

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
});

describe('completar dados pelo cabecalho', () => {
  it('abre o dialogo com o foco no botao de fechar', async () => {
    await render();
    await clicar('Completar dados');

    expect(tituloDoDialogo()).toBe('Completar dados');
    expect(document.activeElement.getAttribute('aria-label')).toBe('Fechar');
  });

  it('fica ao lado de Importar, e os dois abrem dialogos diferentes', async () => {
    await render();

    const nomes = Array.from(container.querySelectorAll('[data-gatilhos] button')).map((b) =>
      b.textContent.trim(),
    );

    expect(nomes.indexOf('Completar dados')).toBe(nomes.indexOf('Importar') + 1);

    await clicar('Importar');
    expect(tituloDoDialogo()).toBe('Importar produtos');
  });

  it('abre um dialogo por vez e devolve o foco ao gatilho quando fecha', async () => {
    await render();
    await clicar('Completar dados');

    expect(dialogos()).toHaveLength(1);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(dialogos()).toHaveLength(0);
    expect(document.activeElement).toBe(botao('Completar dados'));

    await clicar('Backup');
    expect(dialogos()).toHaveLength(1);
    expect(tituloDoDialogo()).toBe('Arquivo de backup');
  });
});
