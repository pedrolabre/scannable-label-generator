// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import AppShell, { MAIN_CONTENT_ID } from './AppShell.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

let container;
let root;

function render(ui) {
  act(() => {
    root.render(ui);
  });
}

function Header() {
  return (
    <header>
      <h1>LabelForge</h1>
      <button type="button">Ação do cabeçalho</button>
    </header>
  );
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

describe('atalho para o conteudo', () => {
  it('e o primeiro elemento focavel da pagina, antes do cabecalho', () => {
    render(
      <AppShell header={<Header />}>
        <button type="button">Cadastrar produto</button>
      </AppShell>,
    );

    const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));

    expect(focusable.length).toBeGreaterThanOrEqual(3);
    expect(focusable[0].tagName).toBe('A');
    expect(focusable[0].textContent).toBe('Pular para o conteúdo');
    expect(focusable[1].textContent).toBe('Ação do cabeçalho');
    expect(focusable[2].textContent).toBe('Cadastrar produto');
  });

  it('aponta para o identificador que o conteudo principal carrega', () => {
    render(<AppShell header={<Header />}>conteúdo</AppShell>);

    const atalho = container.querySelector('a[href^="#"]');
    const principal = container.querySelector('main');

    expect(atalho.getAttribute('href')).toBe(`#${MAIN_CONTENT_ID}`);
    expect(principal.id).toBe(MAIN_CONTENT_ID);
  });

  it('fica fora da vista ate receber foco', () => {
    render(<AppShell header={<Header />}>conteúdo</AppShell>);

    const atalho = container.querySelector('a[href^="#"]');

    expect(atalho.className).toContain('sr-only');
    expect(atalho.className).toContain('focus:not-sr-only');
  });
});

describe('conteudo principal', () => {
  it('aceita foco por programa sem entrar na ordem de tabulacao', () => {
    render(<AppShell header={<Header />}>conteúdo</AppShell>);

    const principal = container.querySelector('main');

    expect(principal.getAttribute('tabindex')).toBe('-1');
    expect(principal.matches(FOCUSABLE_SELECTOR)).toBe(false);
  });

  it('recebe o foco quando o atalho leva ate ele', () => {
    render(<AppShell header={<Header />}>conteúdo</AppShell>);

    const principal = container.querySelector('main');

    act(() => {
      principal.focus();
    });

    expect(document.activeElement).toBe(principal);
  });

  it('desenha o conteudo que recebeu', () => {
    render(
      <AppShell header={<Header />}>
        <p>Produtos cadastrados</p>
      </AppShell>,
    );

    expect(container.querySelector('main').textContent).toContain('Produtos cadastrados');
  });
});
