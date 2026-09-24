// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { usePrintJobStore } from './store/usePrintJobStore.js';
import { useProductStore } from './store/useProductStore.js';

const generateSymbol = vi.hoisted(() => vi.fn());

vi.mock('./lib/barcode.js', () => ({ generateSymbol }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PRODUCT = {
  id: '6f0f3f3a-6f4f-4f4a-8f4a-6f4f4f4a8f4a',
  systemCode: 'MOV-00412',
  displayName: 'Guarda-roupa seis portas',
  priceInCentavos: 189990,
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
};

const SYMBOL = Object.freeze({
  systemCode: PRODUCT.systemCode,
  symbology: 'qrcode',
  errorCorrectionLevel: 'Q',
  moduleCount: 21,
  quietZoneModules: 4,
  totalModules: 29,
  svg: '<svg viewBox="0 0 58 58"><rect width="58" height="58" fill="#FFFFFF"/></svg>',
});

let container;
let root;
let estadoInicialDoCatalogo;
let estadoInicialDoTrabalho;

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
  estadoInicialDoTrabalho = usePrintJobStore.getState();

  generateSymbol.mockResolvedValue(SYMBOL);

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
  usePrintJobStore.setState(estadoInicialDoTrabalho, true);
  generateSymbol.mockReset();
});

describe('os quatro gatilhos', () => {
  it('abre o cadastro pelo cabecalho', async () => {
    await render();
    await clicar('Novo produto');

    expect(tituloDoDialogo()).toBe('Novo produto');
  });

  it('abre a importacao pelo cabecalho', async () => {
    await render();
    await clicar('Importar');

    expect(tituloDoDialogo()).toBe('Importar produtos');
  });

  it('abre o backup pelo cabecalho', async () => {
    await render();
    await clicar('Backup');

    expect(tituloDoDialogo()).toBe('Arquivo de backup');
  });

  it('abre a previa ampliada pela coluna da direita', async () => {
    useProductStore.setState({ products: [PRODUCT], isLoading: false, loadError: null });

    await render();
    await clicar(`Ver etiqueta de ${PRODUCT.displayName}`);
    await clicar('Ampliar prévia');

    expect(tituloDoDialogo()).toBe(PRODUCT.displayName);
  });
});

describe('as duas previas', () => {
  it('abre a folha pela coluna da esquerda, e a etiqueta pela da direita', async () => {
    useProductStore.setState({ products: [PRODUCT], isLoading: false, loadError: null });
    usePrintJobStore.getState().toggleProduct(PRODUCT.id);

    await render();
    await clicar('Prévia da folha');

    expect(tituloDoDialogo()).toBe('Prévia da folha');
    expect(container.querySelector('[role="dialog"] [data-sheet-surface]')).not.toBeNull();

    await clicar('Fechar');
    await clicar(`Ver etiqueta de ${PRODUCT.displayName}`);
    await clicar('Ampliar');

    expect(tituloDoDialogo()).toBe(PRODUCT.displayName);
    expect(container.querySelector('[role="dialog"] [data-sheet-surface]')).toBeNull();
    expect(container.querySelector('[role="dialog"] [data-label-surface]')).not.toBeNull();
  });

  it('usa a mesma ampliacao na coluna e no dialogo da etiqueta', async () => {
    useProductStore.setState({ products: [PRODUCT], isLoading: false, loadError: null });

    await render();
    await clicar(`Ver etiqueta de ${PRODUCT.displayName}`);

    await act(async () => {
      container.querySelector('input[name="ampliacao-etiqueta"][value="2"]').click();
    });

    await clicar('Ampliar');

    const dialogo = container.querySelector('[role="dialog"]');

    expect(dialogo.querySelector('input[name="ampliacao-etiqueta"][value="2"]').checked).toBe(true);
    expect(dialogo.querySelector('[data-label-surface]').style.transform).toBe('scale(2)');

    await act(async () => {
      dialogo.querySelector('input[name="ampliacao-etiqueta"][value="1.5"]').click();
    });
    await clicar('Fechar');

    const coluna = container.querySelector('[data-label-preview]');

    expect(coluna.querySelector('[data-label-surface]').style.transform).toBe('scale(1.5)');
  });

  it('conta as folhas na linha de estado', async () => {
    useProductStore.setState({ products: [PRODUCT], isLoading: false, loadError: null });

    await render();

    expect(container.querySelector('[data-status-sheets]').textContent).toBe('0 folhas');

    await act(async () => {
      usePrintJobStore.getState().toggleProduct(PRODUCT.id);
    });

    expect(container.querySelector('[data-status-sheets]').textContent).toBe('1 folha');
  });
});

describe('um dialogo por vez', () => {
  it('nunca deixa dois abertos ao mesmo tempo', async () => {
    useProductStore.setState({ products: [PRODUCT], isLoading: false, loadError: null });
    usePrintJobStore.getState().toggleProduct(PRODUCT.id);

    await render();
    await clicar(`Ver etiqueta de ${PRODUCT.displayName}`);

    for (const gatilho of [
      'Novo produto',
      'Importar',
      'Backup',
      'Ampliar prévia',
      'Prévia da folha',
    ]) {
      if (dialogos().length > 0) {
        await clicar('Fechar');
      }

      await clicar(gatilho);

      expect(dialogos()).toHaveLength(1);
    }
  });

  it('nao deixa nenhum aberto na primeira tela', async () => {
    await render();

    expect(dialogos()).toHaveLength(0);
  });

  it('fecha o dialogo aberto sem abrir outro', async () => {
    await render();
    await clicar('Importar');
    await clicar('Fechar');

    expect(dialogos()).toHaveLength(0);
  });
});

describe('edicao', () => {
  it('abre o cadastro preenchido pelo rodape da coluna da direita', async () => {
    useProductStore.setState({ products: [PRODUCT], isLoading: false, loadError: null });

    await render();
    await clicar(`Ver etiqueta de ${PRODUCT.displayName}`);
    await clicar('Editar produto');

    expect(tituloDoDialogo()).toBe('Editar produto');
  });
});

describe('vistas da tela estreita', () => {
  function vistaAtiva() {
    return container.querySelector('main > [data-vista-ativa]').getAttribute('data-vista');
  }

  it('abre na listagem e troca de vista pela barra do cabecalho', async () => {
    await render();

    expect(vistaAtiva()).toBe('produtos');

    await act(async () => {
      container.querySelector('[data-barra-vistas] input[value="impressao"]').click();
    });

    expect(vistaAtiva()).toBe('impressao');
  });

  it('leva a previa junto quando a etiqueta e escolhida na listagem', async () => {
    useProductStore.setState({ products: [PRODUCT], isLoading: false, loadError: null });

    await render();
    await clicar(`Ver etiqueta de ${PRODUCT.displayName}`);

    expect(vistaAtiva()).toBe('previa');
    expect(container.querySelector('[data-barra-vistas] input[value="previa"]').checked).toBe(true);
  });

  it('marca a linha em previa com fundo e peso, e nao so com a cor', async () => {
    useProductStore.setState({ products: [PRODUCT], isLoading: false, loadError: null });

    await render();
    await clicar(`Ver etiqueta de ${PRODUCT.displayName}`);

    const linha = container.querySelector('tr[data-em-previa]');

    expect(linha.className).toContain('bg-marca-vermelhoTenue');
    expect(linha.querySelector('td p').className).toContain('font-bold');
    expect(botao(`Ver etiqueta de ${PRODUCT.displayName}`).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});

describe('colunas da listagem', () => {
  it('leva o codigo de barras para a linha de apoio, sem coluna propria', async () => {
    const comBarras = { ...PRODUCT, ean: '7891000000017', category: 'Móveis de quarto' };
    useProductStore.setState({ products: [comBarras], isLoading: false, loadError: null });

    await render();

    const cabecalhos = Array.from(container.querySelectorAll('thead th')).map((th) =>
      th.textContent.trim(),
    );

    expect(cabecalhos).toEqual(['Imprimir', 'Produto', 'Código', 'Preço', 'Ações']);
    expect(container.querySelector('tbody [data-ean]').textContent).toBe('7891000000017');
    expect(container.querySelector('tbody td p + p').textContent).toContain('Móveis de quarto');
  });
});

describe('zerar o catalogo', () => {
  const SEGUNDO = {
    ...PRODUCT,
    id: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    systemCode: 'ELE-00713',
    displayName: 'Geladeira duas portas',
  };

  // O banco do navegador nao existe nesta suite: a limpeza do armazenamento e
  // trocada por uma que so esvazia a lista, como o banco vazio faria.
  const limpar = vi.fn(async () => {
    useProductStore.setState({ products: [] });
  });

  async function prepararCatalogoComSelecaoEPrevia() {
    useProductStore.setState({
      products: [PRODUCT, SEGUNDO],
      isLoading: false,
      loadError: null,
      clearAllProducts: limpar,
    });
    usePrintJobStore.getState().toggleProduct(PRODUCT.id);

    await render();
    await clicar(`Ver etiqueta de ${PRODUCT.displayName}`);
  }

  function dialogo() {
    return container.querySelector('[role="dialog"]');
  }

  afterEach(() => {
    limpar.mockClear();
  });

  it('pede confirmacao mostrando quantos produtos saem', async () => {
    await prepararCatalogoComSelecaoEPrevia();
    await clicar('Zerar catálogo');

    expect(tituloDoDialogo()).toBe('Zerar catálogo');
    expect(dialogo().querySelector('[data-clear-catalog-total]').dataset.clearCatalogTotal).toBe('2');
    expect(dialogo().textContent).toContain('2 produtos');
    expect(dialogo().textContent).toContain('definitiva');
    expect(limpar).not.toHaveBeenCalled();
  });

  it('cancelar nao apaga nada', async () => {
    await prepararCatalogoComSelecaoEPrevia();
    await clicar('Zerar catálogo');

    await act(async () => {
      Array.from(dialogo().querySelectorAll('button'))
        .find((elemento) => elemento.textContent.trim() === 'Cancelar')
        .click();
    });

    expect(dialogo()).toBeNull();
    expect(limpar).not.toHaveBeenCalled();
    expect(useProductStore.getState().products).toHaveLength(2);
    expect(usePrintJobStore.getState().selection).toHaveLength(1);
  });

  it('confirmar zera a lista, a selecao da folha e a previa', async () => {
    await prepararCatalogoComSelecaoEPrevia();

    expect(container.querySelector('[data-label-surface]')).not.toBeNull();

    await clicar('Zerar catálogo');

    await act(async () => {
      Array.from(dialogo().querySelectorAll('button'))
        .filter((elemento) => elemento.textContent.trim() === 'Zerar catálogo')
        .at(-1)
        .click();
    });

    expect(limpar).toHaveBeenCalledTimes(1);
    expect(dialogo()).toBeNull();
    expect(useProductStore.getState().products).toEqual([]);
    expect(usePrintJobStore.getState().selection).toEqual([]);
    expect(container.querySelector('[data-label-surface]')).toBeNull();
    expect(container.querySelector('[data-preview-state="empty-catalog"]')).not.toBeNull();
  });
});
