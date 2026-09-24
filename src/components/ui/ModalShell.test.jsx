// @vitest-environment jsdom

import { useState } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ModalShell from './ModalShell.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function render(ui) {
  act(() => {
    root.render(ui);
  });
}

function press(key, options = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }));
  });
}

function overlay() {
  return container.querySelector('[role="dialog"]').parentElement;
}

function fecharButton() {
  return container.querySelector('[aria-label="Fechar"]');
}

/**
 * O dialogo aberto por um gatilho que existe de verdade. Sem ele nao ha como
 * provar a devolucao do foco: o elemento que abriu o dialogo precisa continuar
 * na tela depois que ele fecha.
 */
function ComDialogo({ closeOnBackdrop = true, footer = null }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Abrir
      </button>

      {aberto ? (
        <ModalShell
          title="Importar produtos"
          subtitle="Arquivo conferido inteiro antes de qualquer gravação."
          closeOnBackdrop={closeOnBackdrop}
          onClose={() => setAberto(false)}
          footer={footer}
        >
          <button type="button">Escolher arquivo</button>
          <button type="button">Gravar no catálogo</button>
        </ModalShell>
      ) : null}
    </>
  );
}

// O gatilho recebe foco antes do clique porque e assim que ele chega no uso
// real, por ponteiro ou por teclado. Um `click()` de programa nao move o foco,
// e sem essa linha o dialogo guardaria o corpo da pagina como elemento a quem
// devolver o foco — provando nada sobre a devolucao.
function abrir(props = {}) {
  render(<ComDialogo {...props} />);

  act(() => {
    const gatilho = container.querySelector('button');

    gatilho.focus();
    gatilho.click();
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

describe('nome e papel', () => {
  it('se declara como dialogo modal nomeado pelo proprio titulo', () => {
    abrir();

    const dialogo = container.querySelector('[role="dialog"]');
    const titulo = container.querySelector('h2');

    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(dialogo.getAttribute('aria-labelledby')).toBe(titulo.id);
    expect(titulo.textContent).toBe('Importar produtos');
  });
});

describe('foco', () => {
  it('entra no botao de fechar quando o dialogo aparece', () => {
    abrir();

    expect(document.activeElement).toBe(fecharButton());
  });

  it('nao escapa do painel com Tab no ultimo controle', () => {
    abrir();

    const focaveis = Array.from(
      container.querySelector('[role="dialog"]').querySelectorAll('button'),
    );
    const ultimo = focaveis[focaveis.length - 1];

    act(() => {
      ultimo.focus();
    });
    press('Tab');

    expect(container.querySelector('[role="dialog"]').contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focaveis[0]);
  });

  it('nao escapa do painel com Shift+Tab no primeiro controle', () => {
    abrir();

    const focaveis = Array.from(
      container.querySelector('[role="dialog"]').querySelectorAll('button'),
    );

    act(() => {
      focaveis[0].focus();
    });
    press('Tab', { shiftKey: true });

    expect(document.activeElement).toBe(focaveis[focaveis.length - 1]);
  });

  it('volta para o gatilho quando o dialogo sai', () => {
    abrir();

    const gatilho = container.querySelector('button');

    press('Escape');

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(gatilho);
  });
});

describe('fechamento', () => {
  it('fecha com Esc', () => {
    abrir();

    press('Escape');

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('fecha no clique que nasce na cortina', () => {
    abrir();

    const cortina = overlay();

    act(() => {
      cortina.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('ignora o clique na cortina quando ha trabalho em andamento', () => {
    abrir({ closeOnBackdrop: false });

    const cortina = overlay();

    act(() => {
      cortina.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('nao fecha no clique que nasce dentro do painel', () => {
    abrir();

    act(() => {
      container
        .querySelector('[role="dialog"]')
        .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('fecha pelo botao de fechar', () => {
    abrir();

    act(() => {
      fecharButton().click();
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('altura', () => {
  it('para antes da borda da janela e deixa o corpo crescer', () => {
    abrir();

    const painel = container.querySelector('[role="dialog"]');
    const corpo = painel.children[1];

    expect(painel.className).toContain('max-h-[calc(100dvh-96px)]');
    expect(corpo.className).toContain('overflow-y-auto');
    expect(corpo.className).toContain('min-h-0');
  });

  it('desenha o rodape apenas quando recebe acoes', () => {
    abrir();
    expect(container.querySelector('footer')).toBeNull();

    press('Escape');

    abrir({ footer: <button type="button">Gravar</button> });
    expect(container.querySelector('footer')).not.toBeNull();
  });
});

describe('largura', () => {
  it('recebe a medida do desenho, em pixel', () => {
    render(
      <ModalShell title="Importar produtos" width={680} onClose={vi.fn()}>
        conteúdo
      </ModalShell>,
    );

    expect(container.querySelector('[role="dialog"]').style.width).toBe('680px');
  });
});

describe('dialogo com regiao rolavel propria', () => {
  it('fixa a altura pedida e continua parando no teto da janela', () => {
    render(
      <ModalShell title="Prévia da folha" width={1160} height={760} onClose={vi.fn()}>
        conteúdo
      </ModalShell>,
    );

    const painel = container.querySelector('[role="dialog"]');

    expect(painel.style.height).toBe('760px');
    expect(painel.className).toContain('max-h-[calc(100dvh-96px)]');
  });

  it('entrega o corpo sem rolagem quando o conteudo ja rola por dentro', () => {
    render(
      <ModalShell title="Prévia da folha" scrollBody={false} onClose={vi.fn()}>
        <div data-mesa="" className="overflow-auto">
          mesa
        </div>
      </ModalShell>,
    );

    const corpo = container.querySelector('[role="dialog"]').children[1];

    expect(corpo.className).not.toContain('overflow-y-auto');
    expect(corpo.className).toContain('overflow-hidden');
    expect(corpo.className).toContain('min-h-0');
  });

  it('poe o controle do cabecalho antes do botao de fechar', () => {
    render(
      <ModalShell
        title="Prévia da folha"
        headerActions={<button type="button">Tamanho</button>}
        onClose={vi.fn()}
      >
        conteúdo
      </ModalShell>,
    );

    const cabecalho = container.querySelector('[role="dialog"] header');
    const botoes = [...cabecalho.querySelectorAll('button')];

    expect(botoes.map((botao) => botao.getAttribute('aria-label') ?? botao.textContent)).toEqual([
      'Tamanho',
      'Fechar',
    ]);
    expect(document.activeElement).toBe(fecharButton());
  });
});
