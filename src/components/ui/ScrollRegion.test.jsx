// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import ScrollRegion from './ScrollRegion.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function render(ui) {
  act(() => {
    root.render(ui);
  });
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

describe('area que rola na horizontal', () => {
  it('entra na ordem de tabulacao, para que o teclado alcance o que esta fora da vista', () => {
    render(<ScrollRegion label="Desenho da etiqueta, rolagem horizontal">desenho</ScrollRegion>);

    const area = container.querySelector('[role="group"]');

    expect(area.getAttribute('tabindex')).toBe('0');
  });

  it('leva nome proprio, porque sozinha ela nao diz o que contem', () => {
    render(<ScrollRegion label="Desenho da folha, rolagem horizontal">desenho</ScrollRegion>);

    const area = container.querySelector('[role="group"]');

    expect(area.getAttribute('aria-label')).toBe('Desenho da folha, rolagem horizontal');
  });

  it('acende o mesmo realce de foco das demais primitivas', () => {
    render(<ScrollRegion label="Desenho da etiqueta, rolagem horizontal">desenho</ScrollRegion>);

    const area = container.querySelector('[role="group"]');

    expect(area.className).toContain('overflow-x-auto');
    expect(area.className).toContain('focus-visible:outline');
  });

  it('recebe o foco quando o teclado chega nela', () => {
    render(<ScrollRegion label="Desenho da etiqueta, rolagem horizontal">desenho</ScrollRegion>);

    const area = container.querySelector('[role="group"]');

    act(() => {
      area.focus();
    });

    expect(document.activeElement).toBe(area);
  });

  it('mantem no mesmo elemento os atributos de marcacao que recebe', () => {
    render(
      <ScrollRegion label="Desenho da folha, rolagem horizontal" data-sheet-state="drawn">
        desenho
      </ScrollRegion>,
    );

    const area = container.querySelector('[data-sheet-state="drawn"]');

    expect(area.getAttribute('role')).toBe('group');
    expect(area.textContent).toBe('desenho');
  });
});
