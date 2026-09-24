// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { usePrintJobState } from '../print/printJobState.js';
import { usePrintJobStore } from '../../store/usePrintJobStore.js';

import StatusBar from './StatusBar.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ARMARIO = {
  id: '11111111-1111-4111-8111-111111111111',
  systemCode: 'MOV-00412',
  displayName: 'Armário de cozinha',
  priceInCentavos: 89990,
};

const GELADEIRA = {
  id: '22222222-2222-4222-8222-222222222222',
  systemCode: 'ELE-00713',
  displayName: 'Geladeira duas portas',
  priceInCentavos: 329900,
};

const PRODUCTS = [ARMARIO, GELADEIRA];

let container;
let root;

/** A faixa montada como a tela a monta: a contagem sai da leitura do trabalho. */
function Faixa() {
  const printState = usePrintJobState(PRODUCTS);
  const selection = usePrintJobStore((state) => state.selection);

  return (
    <StatusBar
      productCount={PRODUCTS.length}
      selectedCount={selection.length}
      sheetCount={printState.totalSheets}
    />
  );
}

beforeEach(async () => {
  usePrintJobStore.getState().resetPrintJob();

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<Faixa />);
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

async function update(action) {
  await act(async () => {
    action(usePrintJobStore.getState());
  });
}

function sheets() {
  return container.querySelector('[data-status-sheets]');
}

describe('linha de estado', () => {
  it('mostra total no banco, selecionados e folhas, e nenhuma acao', () => {
    expect(container.textContent).toContain('2 produtos no banco');
    expect(container.textContent).toContain('0 selecionados');
    expect(sheets().textContent).toBe('0 folhas');
    expect(container.querySelectorAll('button, a, input')).toHaveLength(0);
  });

  it('acompanha a selecao e as quantidades', async () => {
    await update((store) => store.toggleProduct(ARMARIO.id));

    expect(container.textContent).toContain('1 selecionado');
    expect(sheets().textContent).toBe('1 folha');

    // Etiqueta de 10 por folha na folha de 10: 7 + 5 = 12 etiquetas, 2 folhas.
    await update((store) => store.toggleProduct(GELADEIRA.id));
    await update((store) => store.setCopies(ARMARIO.id, '7'));
    await update((store) => store.setCopies(GELADEIRA.id, '5'));

    expect(sheets().textContent).toBe('2 folhas');
  });

  it('acompanha o modelo de etiqueta e o de folha escolhidos', async () => {
    await update((store) => store.toggleProduct(ARMARIO.id));
    await update((store) => store.setCopies(ARMARIO.id, '25'));

    // 25 etiquetas de 10 por folha: 3 folhas.
    expect(sheets().dataset.statusSheets).toBe('3');

    // A tag grande rende 3 por folha em retrato: 25 pedem 9.
    await update((store) => store.setLabelLayoutId('tag-grande'));
    await update((store) => store.setSheetLayoutId('a4-retrato'));

    expect(sheets().dataset.statusSheets).toBe('9');

    // A etiqueta pequena rende 24 por folha em retrato: 25 pedem 2.
    await update((store) => store.setLabelLayoutId('etiqueta-pequena'));

    expect(sheets().dataset.statusSheets).toBe('2');

    // Em paisagem a mesma etiqueta rende 25 por folha: as 25 cabem numa so.
    await update((store) => store.setSheetLayoutId('a4-paisagem'));

    expect(sheets().dataset.statusSheets).toBe('1');
  });

  it('volta a zero quando a configuracao deixa de valer', async () => {
    await update((store) => store.toggleProduct(ARMARIO.id));
    await update((store) => store.setCopies(ARMARIO.id, '0'));

    expect(sheets().textContent).toBe('0 folhas');
  });
});
