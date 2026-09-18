// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { announceUpdate, resetUpdateState } from '../../pwa/updateState.js';

import UpdateNotice from './UpdateNotice.jsx';

/**
 * A descoberta da versao nova entra pelo mesmo caminho que o registro usa, e o
 * registro em si fica de fora: ele so existe depois do empacotamento. O que se
 * prova aqui e a tela — quando o aviso aparece, o que ele diz e o que o clique
 * dispara.
 */

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  container = null;
  root = null;
  resetUpdateState();
});

function render() {
  act(() => {
    root.render(<UpdateNotice />);
  });
}

function botaoDeAtualizar() {
  return [...container.querySelectorAll('button')].find(
    (botao) => botao.textContent.trim() === 'Atualizar agora',
  );
}

describe('sem versao nova', () => {
  it('nao ocupa espaco nenhum na pagina', () => {
    render();

    expect(container.textContent).toBe('');
    expect(container.querySelector('button')).toBe(null);
  });
});

describe('com versao nova', () => {
  it('aparece assim que a versao nova e anunciada, sem remontar a pagina', () => {
    render();

    act(() => {
      announceUpdate(() => {});
    });

    expect(container.textContent).toContain('Uma nova versão do LabelForge está disponível.');
  });

  it('avisa que a folha em preparo nao sobrevive ao recarregamento', () => {
    render();

    act(() => {
      announceUpdate(() => {});
    });

    expect(container.textContent).toContain('A folha em preparo não é mantida ao recarregar.');
  });

  it('oferece a acao de atualizar', () => {
    render();

    act(() => {
      announceUpdate(() => {});
    });

    expect(botaoDeAtualizar()).toBeTruthy();
  });
});

describe('acao de atualizar', () => {
  it('aplica a troca uma vez e tira o aviso da tela', () => {
    const aplicar = vi.fn();

    render();

    act(() => {
      announceUpdate(aplicar);
    });

    const botao = botaoDeAtualizar();

    act(() => {
      botao.click();
    });

    expect(aplicar).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('');
  });
});
