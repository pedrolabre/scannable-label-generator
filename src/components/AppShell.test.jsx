// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import AppShell, { MAIN_CONTENT_ID, SHELL_VIEWS } from './AppShell.jsx';

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

function shell(props = {}) {
  return (
    <AppShell
      header={<Header />}
      left={<section aria-label="Trabalho de impressão">impressão</section>}
      center={<section aria-label="Produtos">produtos</section>}
      right={<section aria-label="Prévia da etiqueta">prévia</section>}
      status={<footer>estado</footer>}
      {...props}
    />
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
  it('e o primeiro elemento focavel da tela, antes do cabecalho', () => {
    render(
      shell({
        center: (
          <section aria-label="Produtos">
            <button type="button">Cadastrar produto</button>
          </section>
        ),
      }),
    );

    const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));

    expect(focusable.length).toBeGreaterThanOrEqual(3);
    expect(focusable[0].tagName).toBe('A');
    expect(focusable[0].textContent).toBe('Pular para o conteúdo');
    expect(focusable[1].textContent).toBe('Ação do cabeçalho');
    expect(focusable[2].textContent).toBe('Cadastrar produto');
  });

  it('aponta para o identificador que o conteudo principal carrega', () => {
    render(shell());

    const atalho = container.querySelector('a[href^="#"]');
    const principal = container.querySelector('main');

    expect(atalho.getAttribute('href')).toBe(`#${MAIN_CONTENT_ID}`);
    expect(principal.id).toBe(MAIN_CONTENT_ID);
  });

  it('fica fora da vista ate receber foco', () => {
    render(shell());

    const atalho = container.querySelector('a[href^="#"]');

    expect(atalho.className).toContain('sr-only');
    expect(atalho.className).toContain('focus:not-sr-only');
  });
});

describe('conteudo principal', () => {
  it('aceita foco por programa sem entrar na ordem de tabulacao', () => {
    render(shell());

    const principal = container.querySelector('main');

    expect(principal.getAttribute('tabindex')).toBe('-1');
    expect(principal.matches(FOCUSABLE_SELECTOR)).toBe(false);
  });

  it('recebe o foco quando o atalho leva ate ele', () => {
    render(shell());

    const principal = container.querySelector('main');

    act(() => {
      principal.focus();
    });

    expect(document.activeElement).toBe(principal);
  });
});

describe('cinco faixas', () => {
  it('desenha o cabecalho, as tres colunas e a linha de estado, nesta ordem', () => {
    render(shell());

    const regioes = Array.from(container.querySelectorAll('section[aria-label]')).map((secao) =>
      secao.getAttribute('aria-label'),
    );

    expect(regioes).toEqual(['Trabalho de impressão', 'Produtos', 'Prévia da etiqueta']);
    expect(container.querySelector('header').textContent).toContain('LabelForge');
    expect(container.querySelector('footer').textContent).toBe('estado');
  });

  it('mantem as tres colunas dentro do conteudo principal', () => {
    render(shell());

    const principal = container.querySelector('main');

    expect(principal.querySelectorAll('section[aria-label]')).toHaveLength(3);
  });
});

describe('a janela e o limite', () => {
  /**
   * O `jsdom` nao faz layout, entao medir altura aqui nao prova nada: toda
   * altura sai zero. O que se prova e o contrato que produz o resultado — a
   * raiz presa a altura disponivel, sem transbordo, e o conteudo principal
   * livre para encolher abaixo do proprio conteudo. Sem `min-h-0`, o
   * `overflow-y` dos corpos nao vale, e essa e a regressao que volta sozinha.
   */
  it('prende a raiz a altura disponivel e nao deixa nada transbordar', () => {
    render(shell());

    const raiz = container.firstElementChild;

    expect(raiz.className).toContain('h-full');
    expect(raiz.className).toContain('overflow-hidden');
  });

  it('deixa o conteudo principal encolher abaixo do proprio conteudo', () => {
    render(shell());

    expect(container.querySelector('main').className).toContain('min-h-0');
  });
});

describe('tela estreita', () => {
  /**
   * Abaixo do ponto de corte so a vista ativa aparece. O `jsdom` nao aplica
   * media query, entao o que se prova e o contrato das classes: a vista ativa
   * e a unica sem `hidden`, as tres voltam com `lg:flex`, e a grade tem uma
   * coluna so ate o ponto de corte.
   */
  function vistas() {
    return Array.from(container.querySelectorAll('main > [data-vista]'));
  }

  function visiveisNaTelaEstreita() {
    return vistas().filter((vista) => !vista.className.split(' ').includes('hidden'));
  }

  it('mostra uma coluna so, a da vista ativa', () => {
    render(shell({ activeView: SHELL_VIEWS.PREVIEW }));

    const visiveis = visiveisNaTelaEstreita();

    expect(visiveis).toHaveLength(1);
    expect(visiveis[0].getAttribute('data-vista')).toBe('previa');
    expect(visiveis[0].querySelector('section').getAttribute('aria-label')).toBe(
      'Prévia da etiqueta',
    );
  });

  it('abre na listagem quando ninguem escolheu a vista', () => {
    render(shell());

    expect(visiveisNaTelaEstreita().map((vista) => vista.getAttribute('data-vista'))).toEqual([
      'produtos',
    ]);
  });

  it('devolve as tres colunas a partir do ponto de corte', () => {
    render(shell({ activeView: SHELL_VIEWS.PRINT }));

    for (const vista of vistas()) {
      expect(vista.className).toContain('lg:flex');
    }

    const grade = container.querySelector('main').className;

    expect(grade).toContain('grid-cols-1');
    expect(grade).toContain('lg:grid-cols-janela');
  });

  it('continua sem rolar a raiz', () => {
    render(shell({ activeView: SHELL_VIEWS.PRINT }));

    const raiz = container.firstElementChild;

    expect(raiz.className).toContain('h-full');
    expect(raiz.className).toContain('overflow-hidden');

    for (const vista of vistas()) {
      expect(vista.className).toContain('min-h-0');
      expect(vista.className).not.toMatch(/overflow-(y-)?(auto|scroll)/);
    }
  });
});
