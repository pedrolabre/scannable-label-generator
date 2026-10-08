// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import AppShell from './AppShell.jsx';
import { DRAG_THRESHOLD } from './layout/ShellDrawer.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PointerEventClass = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;

let container;
let root;

function render(ui) {
  act(() => {
    root.render(ui);
  });
}

function shell() {
  return (
    <AppShell
      header={<header>cabeçalho</header>}
      left={
        <section aria-label="Trabalho de impressão">
          <button type="button" data-dentro-esquerda="">
            Prévia da folha
          </button>
        </section>
      }
      center={
        <section aria-label="Produtos">
          <button type="button" data-listagem="">
            Editar
          </button>
        </section>
      }
      right={<section aria-label="Prévia da etiqueta">prévia</section>}
      status={<footer>estado</footer>}
    />
  );
}

function drawer(side) {
  return container.querySelector(`[data-gaveta="${side}"]`);
}

function handle(side) {
  return drawer(side).querySelector('[data-gaveta-alca]');
}

function isOpen(side) {
  return drawer(side).hasAttribute('data-gaveta-aberta');
}

function click(element) {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function pointer(element, type, clientX = 0) {
  act(() => {
    element.dispatchEvent(new PointerEventClass(type, { bubbles: true, clientX, button: 0 }));
  });
}

function drag(element, from, to) {
  pointer(element, 'pointerdown', from);
  pointer(element, 'pointerup', to);
  click(element);
}

function pressEscape(target) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
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

describe('alca das gavetas', () => {
  it('fica na borda das duas laterais que encosta na listagem, so na tela larga', () => {
    render(shell());

    const esquerda = handle('esquerda');
    const direita = handle('direita');

    expect(esquerda.className).toContain('right-0');
    expect(direita.className).toContain('left-0');

    for (const alca of [esquerda, direita]) {
      expect(alca.className).toContain('hidden');
      expect(alca.className).toContain('lg:flex');
      expect(alca.getAttribute('aria-expanded')).toBe('false');
    }

    expect(container.querySelector('[data-vista="produtos"] [data-gaveta]')).toBeNull();
  });

  it('nomeia a acao e aponta para a gaveta que controla', () => {
    render(shell());

    const alca = handle('esquerda');

    expect(alca.getAttribute('aria-label')).toBe('Alargar trabalho de impressão');
    expect(alca.getAttribute('aria-controls')).toBe(drawer('esquerda').id);

    click(alca);

    expect(alca.getAttribute('aria-label')).toBe('Recolher trabalho de impressão');
    expect(alca.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('abrir e fechar', () => {
  it('abre por cima da listagem com largura fixa e fecha no segundo clique', () => {
    render(shell());

    click(handle('esquerda'));

    expect(isOpen('esquerda')).toBe(true);
    expect(drawer('esquerda').className).toContain('lg:absolute');
    expect(drawer('esquerda').className).toContain('lg:right-gaveta-esquerda');
    expect(container.querySelector('main').className).toContain('lg:relative');

    click(handle('esquerda'));

    expect(isOpen('esquerda')).toBe(false);
    expect(drawer('esquerda').className).not.toContain('lg:absolute');
  });

  it('abre a direita espelhada, a partir da borda direita', () => {
    render(shell());

    click(handle('direita'));

    expect(isOpen('direita')).toBe(true);
    expect(drawer('direita').className).toContain('lg:right-0');
    expect(drawer('direita').className).toContain('lg:w-gaveta-direita');
  });

  it('mantem a grade como esta com a gaveta aberta', () => {
    render(shell());

    const vistas = () =>
      Array.from(container.querySelectorAll('main > [data-vista]')).map((vista) => vista.className);
    const antes = vistas();

    click(handle('esquerda'));

    expect(vistas()).toEqual(antes);
    expect(container.querySelector('main').className).toContain('lg:grid-cols-janela');
  });

  it('nao monta a coluna de novo ao abrir', () => {
    render(shell());

    const botao = container.querySelector('[data-dentro-esquerda]');

    click(handle('esquerda'));

    expect(container.querySelector('[data-dentro-esquerda]')).toBe(botao);
  });

  it('abre uma por vez', () => {
    render(shell());

    click(handle('esquerda'));
    click(handle('direita'));

    expect(isOpen('esquerda')).toBe(false);
    expect(isOpen('direita')).toBe(true);
  });
});

describe('arrastar a alca', () => {
  it('abre arrastando para a listagem e fecha arrastando para a borda', () => {
    render(shell());

    drag(handle('esquerda'), 100, 100 + DRAG_THRESHOLD + 40);
    expect(isOpen('esquerda')).toBe(true);

    drag(handle('esquerda'), 500, 500 - DRAG_THRESHOLD - 40);
    expect(isOpen('esquerda')).toBe(false);
  });

  it('usa a direcao espelhada na gaveta da direita', () => {
    render(shell());

    drag(handle('direita'), 900, 900 - DRAG_THRESHOLD - 40);
    expect(isOpen('direita')).toBe(true);

    drag(handle('direita'), 600, 600 + DRAG_THRESHOLD + 40);
    expect(isOpen('direita')).toBe(false);
  });

  it('arrastar para o lado que ja esta nao muda nada', () => {
    render(shell());

    drag(handle('esquerda'), 500, 500 - DRAG_THRESHOLD - 40);

    expect(isOpen('esquerda')).toBe(false);
  });

  it('trata o deslocamento curto como clique', () => {
    render(shell());

    drag(handle('esquerda'), 100, 100 + DRAG_THRESHOLD - 1);

    expect(isOpen('esquerda')).toBe(true);
  });
});

describe('fechar sem a alca', () => {
  it('fecha com Esc vindo de dentro do conteudo principal', () => {
    render(shell());

    click(handle('esquerda'));
    pressEscape(container.querySelector('[data-dentro-esquerda]'));

    expect(isOpen('esquerda')).toBe(false);
  });

  it('fecha com Esc quando o foco esta no body', () => {
    render(shell());

    click(handle('direita'));
    pressEscape(document.body);

    expect(isOpen('direita')).toBe(false);
  });

  it('deixa o Esc de um dialogo fora do conteudo principal para o dialogo', () => {
    render(shell());

    const dialogo = document.createElement('div');
    document.body.appendChild(dialogo);

    click(handle('esquerda'));
    pressEscape(dialogo);

    expect(isOpen('esquerda')).toBe(true);

    dialogo.remove();
  });

  it('fecha com um toque na listagem', () => {
    render(shell());

    click(handle('esquerda'));
    pointer(container.querySelector('[data-listagem]'), 'pointerdown');

    expect(isOpen('esquerda')).toBe(false);
  });

  it('continua aberta com um toque dentro dela', () => {
    render(shell());

    click(handle('esquerda'));
    pointer(container.querySelector('[data-dentro-esquerda]'), 'pointerdown');

    expect(isOpen('esquerda')).toBe(true);
  });

  it('continua aberta com um toque no cabecalho', () => {
    render(shell());

    click(handle('esquerda'));
    pointer(container.querySelector('header'), 'pointerdown');

    expect(isOpen('esquerda')).toBe(true);
  });
});
