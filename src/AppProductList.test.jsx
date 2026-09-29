// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { inventCatalog } from './components/product-list/listFixtures.js';
import { compareProductsByName } from './domain/services/productSearch.js';
import { usePrintJobStore } from './store/usePrintJobStore.js';
import { useProductStore } from './store/useProductStore.js';

const generateSymbol = vi.hoisted(() => vi.fn());

vi.mock('./lib/barcode.js', () => ({ generateSymbol }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Os casos montam a listagem inteira no jsdom, e o tempo de cada um varia com a
// carga da maquina: o limite padrao de 5 s nao comporta essa variacao.
vi.setConfig({ testTimeout: 30_000 });

const PRODUCTS = inventCatalog(120);
const ORDER = [...PRODUCTS].sort(compareProductsByName);

let container;
let root;
let estadoInicialDoCatalogo;
let estadoInicialDoTrabalho;

function caixas(produto) {
  return container.querySelectorAll(`input[aria-label="Imprimir etiqueta de ${produto.displayName}"]`);
}

async function marcarNaTabela(produto) {
  const caixa = container.querySelector(
    `tbody input[aria-label="Imprimir etiqueta de ${produto.displayName}"]`,
  );

  expect(caixa, `caixa de ${produto.displayName} não encontrada`).toBeTruthy();

  await act(async () => {
    caixa.click();
  });
}

async function irPara(rotulo) {
  const botao = container.querySelector(`button[aria-label="${rotulo}"]`);

  await act(async () => {
    botao.click();
  });
}

function selecionados() {
  return Number(container.querySelector('[data-status-selected]').dataset.statusSelected);
}

beforeEach(async () => {
  estadoInicialDoCatalogo = useProductStore.getState();
  estadoInicialDoTrabalho = usePrintJobStore.getState();

  generateSymbol.mockResolvedValue({
    systemCode: PRODUCTS[0].systemCode,
    symbology: 'qrcode',
    errorCorrectionLevel: 'Q',
    moduleCount: 21,
    quietZoneModules: 4,
    totalModules: 29,
    svg: '<svg viewBox="0 0 58 58"><rect width="58" height="58" fill="#FFFFFF"/></svg>',
  });

  useProductStore.setState({ products: PRODUCTS, isLoading: false, loadError: null });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<App />);
  });
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

describe('marcacao para a folha entre paginas', () => {
  it('os marcados na pagina 1 continuam marcados depois de ir a pagina 2 e voltar', async () => {
    const primeiro = ORDER[0];
    const segundo = ORDER[37];
    const daPaginaDois = ORDER[64];

    await marcarNaTabela(primeiro);
    await marcarNaTabela(segundo);

    expect(selecionados()).toBe(2);

    await irPara('Próxima: ir para a próxima página');

    expect(caixas(primeiro)).toHaveLength(0);

    await marcarNaTabela(daPaginaDois);
    await irPara('Anterior: ir para a página anterior');

    for (const produto of [primeiro, segundo]) {
      const marcadas = Array.from(caixas(produto));

      expect(marcadas).toHaveLength(2);
      expect(marcadas.every((caixa) => caixa.checked)).toBe(true);
    }

    expect(selecionados()).toBe(3);
    expect(usePrintJobStore.getState().selection.map((entrada) => entrada.productId)).toEqual([
      primeiro.id,
      segundo.id,
      daPaginaDois.id,
    ]);
  });

  it('a troca de pagina nao muda o conjunto marcado nem a contagem da folha', async () => {
    await marcarNaTabela(ORDER[3]);
    await marcarNaTabela(ORDER[12]);

    const selecaoAntes = usePrintJobStore.getState().selection;
    const folhasAntes = container.querySelector('[data-status-sheets]').dataset.statusSheets;

    await irPara('Próxima: ir para a próxima página');
    await irPara('Próxima: ir para a próxima página');
    await irPara('Anterior: ir para a página anterior');

    expect(usePrintJobStore.getState().selection).toBe(selecaoAntes);
    expect(selecionados()).toBe(2);
    expect(container.querySelector('[data-status-sheets]').dataset.statusSheets).toBe(folhasAntes);
  });
});
