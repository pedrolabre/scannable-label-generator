// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppHeader from './AppHeader.jsx';
import { SHELL_VIEWS } from './AppShell.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function render(props = {}) {
  act(() => {
    root.render(
      <AppHeader
        onNewProduct={vi.fn()}
        onImport={vi.fn()}
        onBackup={vi.fn()}
        onViewChange={vi.fn()}
        {...props}
      />,
    );
  });
}

function classes(elemento) {
  return elemento.className.split(/\s+/);
}

beforeEach(() => {
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

describe('marca e gatilhos em largura estreita', () => {
  /**
   * O `jsdom` nao faz layout. O que impede a sobreposicao e o contrato da
   * linha: marca e botoes sao irmaos no mesmo fluxo, nenhum deles sai do fluxo
   * por posicao absoluta, os botoes nao encolhem e a marca encolhe com
   * reticencias. Com isso, a soma nunca passa da largura: quem cede e o nome.
   */
  it('poe a marca e os tres botoes lado a lado, no mesmo fluxo', () => {
    render();

    const marca = container.querySelector('[data-marca]');
    const gatilhos = container.querySelector('[data-gatilhos]');

    expect(marca.parentElement).toBe(gatilhos.parentElement);
    expect(gatilhos.querySelectorAll('button')).toHaveLength(3);

    for (const elemento of [marca, gatilhos, ...gatilhos.querySelectorAll('button')]) {
      expect(classes(elemento)).not.toContain('absolute');
      expect(classes(elemento)).not.toContain('fixed');
    }
  });

  it('deixa a marca ceder espaco e os botoes nao', () => {
    render();

    const marca = container.querySelector('[data-marca]');
    const nome = marca.querySelector('h1');
    const gatilhos = container.querySelector('[data-gatilhos]');

    expect(classes(marca)).toContain('min-w-0');
    expect(classes(nome)).toContain('min-w-0');
    expect(classes(nome)).toContain('truncate');
    expect(classes(gatilhos)).toContain('flex-none');
  });

  it('esconde o texto dos botoes so da vista no telefone, mantendo o nome', () => {
    render();

    const nomes = Array.from(container.querySelectorAll('[data-gatilhos] button')).map((botao) =>
      botao.textContent.trim(),
    );
    const textos = container.querySelectorAll('[data-gatilhos] button span');

    expect(nomes).toEqual(['Importar', 'Backup', 'Novo produto']);

    for (const texto of textos) {
      expect(classes(texto)).toContain('max-sm:sr-only');
    }
  });
});

describe('barra de vistas', () => {
  it('oferece as tres vistas e marca a ativa', () => {
    render({ activeView: SHELL_VIEWS.PRINT });

    const barra = container.querySelector('[data-barra-vistas]');
    const opcoes = Array.from(barra.querySelectorAll('input[type="radio"]'));

    expect(opcoes.map((opcao) => opcao.closest('label').textContent)).toEqual([
      'Impressão',
      'Produtos',
      'Prévia',
    ]);
    expect(opcoes.filter((opcao) => opcao.checked).map((opcao) => opcao.value)).toEqual([
      'impressao',
    ]);
  });

  it('existe so abaixo do ponto de corte', () => {
    render();

    expect(classes(container.querySelector('[data-barra-vistas]'))).toContain('lg:hidden');
  });

  it('avisa a troca de vista', () => {
    const onViewChange = vi.fn();
    render({ onViewChange });

    act(() => {
      container.querySelector('[data-barra-vistas] input[value="previa"]').click();
    });

    expect(onViewChange).toHaveBeenCalledWith('previa');
  });
});
