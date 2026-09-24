// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SheetLayoutSchema } from '../../domain/schemas/sheetLayoutSchema.js';
import { findLabelLayout } from '../../domain/services/labelLayoutCatalog.js';
import { computeSheetGrid } from '../../domain/services/sheetGrid.js';
import { findSheetLayout } from '../../domain/services/sheetLayoutCatalog.js';
import { buildSymbolText } from '../../domain/services/symbolContent.js';
import { BARCODE_ERROR_CODES, BarcodeError } from '../../lib/barcodeError.js';

import SheetPreview from './SheetPreview.jsx';

const generateSymbol = vi.hoisted(() => vi.fn());

vi.mock('../../lib/barcode.js', () => ({ generateSymbol }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const RETRATO = findSheetLayout('a4-retrato');
const GRANDE = findLabelLayout('tag-grande');
const PEQUENA = findLabelLayout('etiqueta-pequena');

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

const RECUSADO = {
  id: '33333333-3333-4333-8333-333333333333',
  systemCode: 'FOG-00999',
  displayName: 'Fogão cinco bocas',
  priceInCentavos: 219900,
};

const PRODUCTS = [ARMARIO, GELADEIRA, RECUSADO];

function symbolFor(text) {
  return Object.freeze({
    text,
    symbology: 'qrcode',
    errorCorrectionLevel: 'M',
    moduleCount: 21,
    quietZoneModules: 4,
    totalModules: 29,
    svg: '<svg viewBox="0 0 58 58"><rect width="58" height="58" fill="#FFFFFF"/></svg>',
  });
}

let container;
let root;

beforeEach(() => {
  generateSymbol.mockImplementation(async (text) => {
    if (text.split('|')[1] === RECUSADO.systemCode) {
      throw new BarcodeError(BARCODE_ERROR_CODES.CODE_TOO_LONG, 'O código não cabe no símbolo.');
    }

    return symbolFor(text);
  });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  generateSymbol.mockReset();
});

async function render({ items, sheet = RETRATO, labelLayout = GRANDE, scaleFactor }) {
  const grid = computeSheetGrid(sheet, labelLayout);
  const job = { labelLayoutId: labelLayout.id, sheetLayoutId: sheet.id, items };

  await act(async () => {
    root.render(
      <SheetPreview
        job={job}
        sheet={sheet}
        labelLayout={labelLayout}
        grid={grid}
        products={PRODUCTS}
        scaleFactor={scaleFactor}
      />,
    );
  });
}

async function click(button) {
  await act(async () => {
    button.click();
  });
}

function cells() {
  return [...container.querySelectorAll('[data-sheet-cell]')];
}

function buttonWithText(text) {
  return [...container.querySelectorAll('button')].find((button) =>
    button.textContent.includes(text),
  );
}

describe('folha desenhada', () => {
  it('posiciona cada etiqueta na medida calculada pela grade', async () => {
    await render({ items: [{ productId: ARMARIO.id, copies: 2 }], labelLayout: PEQUENA });

    const sheet = container.querySelector('[data-sheet-surface]');

    expect(sheet.style.width).toBe('210mm');
    expect(sheet.style.height).toBe('297mm');
    expect(sheet.style.transform).toBe('scale(0.5)');
    expect(cells()).toHaveLength(2);
    expect(cells()[1].style.left).toBe('63mm');
    expect(cells()[1].style.top).toBe('10mm');
    expect(cells()[1].dataset.copyNumber).toBe('2');
    expect(container.querySelectorAll('[data-label-surface]')).toHaveLength(2);
  });

  it('gera um simbolo por exemplar: copias do mesmo produto tem simbolos diferentes', async () => {
    await render({
      items: [
        { productId: ARMARIO.id, copies: 3 },
        { productId: GELADEIRA.id, copies: 2 },
      ],
      labelLayout: PEQUENA,
    });

    const ready = [...container.querySelectorAll('[data-symbol-state="ready"]')];

    expect(generateSymbol).toHaveBeenCalledTimes(5);
    expect(ready).toHaveLength(5);
    expect(ready.map((symbol) => symbol.dataset.symbolText)).toEqual([
      buildSymbolText(ARMARIO, 1),
      buildSymbolText(ARMARIO, 2),
      buildSymbolText(ARMARIO, 3),
      buildSymbolText(GELADEIRA, 1),
      buildSymbolText(GELADEIRA, 2),
    ]);
    expect(new Set(ready.map((symbol) => symbol.dataset.symbolText)).size).toBe(5);
  });

  it('desenha em tamanho real sem mexer na medida da folha', async () => {
    await render({ items: [{ productId: ARMARIO.id, copies: 1 }], scaleFactor: 1 });

    const sheet = container.querySelector('[data-sheet-surface]');

    expect(sheet.style.transform).toBe('scale(1)');
    expect(sheet.style.width).toBe('210mm');
    expect(sheet.parentElement.style.width).toBe('210mm');
  });

  it('resume a folha na ficha ao lado da mesa', async () => {
    await render({ items: [{ productId: ARMARIO.id, copies: 2 }], labelLayout: PEQUENA });

    const ficha = container.querySelector('aside[aria-label="Ficha da folha"]');

    expect(ficha.textContent).toContain(RETRATO.name);
    expect(ficha.querySelector('[data-sheet-grid]').textContent).toBe('3 × 8');
    expect(ficha.querySelector('[data-sheet-labels]').textContent).toBe('2');
    expect(ficha.textContent).toContain('10 mm');
  });

  it('mostra a capacidade quando a selecao cabe numa folha', async () => {
    await render({ items: [{ productId: ARMARIO.id, copies: 1 }] });

    const count = container.querySelector('[data-sheet-count]');

    expect(count.dataset.sheetCount).toBe('1');
    expect(count.textContent).toBe('1 etiqueta numa folha que comporta 3 etiquetas.');
    expect(container.querySelector('[data-sheet-navigation]')).toBeNull();
  });
});

describe('selecao que passa de uma folha', () => {
  const items = [
    { productId: ARMARIO.id, copies: 20 },
    { productId: GELADEIRA.id, copies: 30 },
    { productId: RECUSADO.id, copies: 7 },
  ];

  it('avisa com o numero certo de folhas', async () => {
    // Etiqueta pequena em A4 retrato: 24 por folha; 57 etiquetas pedem 3 folhas.
    await render({ items, labelLayout: PEQUENA });

    const count = container.querySelector('[data-sheet-count]');

    expect(count.dataset.sheetCount).toBe('3');
    expect(count.textContent).toBe('A seleção ocupa 3 folhas: 57 etiquetas, 24 por folha.');
    expect(container.querySelector('[data-sheet-position]').textContent).toBe('Folha 1 de 3');
    expect(cells()).toHaveLength(24);
  });

  it('navega entre as folhas e desenha so a folha escolhida', async () => {
    await render({ items, labelLayout: PEQUENA });

    expect(buttonWithText('Anterior').disabled).toBe(true);

    await click(buttonWithText('Próxima'));
    await click(buttonWithText('Próxima'));

    expect(container.querySelector('[data-sheet-position]').textContent).toBe('Folha 3 de 3');
    expect(buttonWithText('Próxima').disabled).toBe(true);
    // Terceira folha: 9 etiquetas, as duas ultimas da geladeira e as sete do fogao.
    expect(cells()).toHaveLength(9);
    expect(cells()[0].dataset.productId).toBe(GELADEIRA.id);
    expect(cells()[0].dataset.copyNumber).toBe('29');
    expect(cells()[8].dataset.productId).toBe(RECUSADO.id);
  });

  it('volta para a ultima folha que existe quando a selecao encolhe', async () => {
    await render({ items, labelLayout: PEQUENA });
    await click(buttonWithText('Próxima'));
    await click(buttonWithText('Próxima'));

    // 20 + 20 = 40 etiquetas: duas folhas, e a terceira deixa de existir.
    await render({
      items: [items[0], { productId: GELADEIRA.id, copies: 20 }],
      labelLayout: PEQUENA,
    });

    expect(container.querySelector('[data-sheet-position]').textContent).toBe('Folha 2 de 2');
    expect(cells()).toHaveLength(16);

    await render({ items: items.slice(0, 1), labelLayout: PEQUENA });

    expect(container.querySelector('[data-sheet-navigation]')).toBeNull();
    expect(cells()).toHaveLength(20);

    // A selecao volta a crescer: a tela fica na folha que estava a vista.
    await render({ items, labelLayout: PEQUENA });

    expect(container.querySelector('[data-sheet-position]').textContent).toBe('Folha 1 de 3');
  });
});

describe('folha que nao comporta nenhuma etiqueta', () => {
  it('nao desenha folha e diz que nada cabe', async () => {
    const apertada = SheetLayoutSchema.parse({ ...RETRATO, marginLeftMm: 60, marginRightMm: 60 });

    await render({ items: [{ productId: ARMARIO.id, copies: 3 }], sheet: apertada });

    const placeholder = container.querySelector('[data-sheet-state="no-capacity"]');

    expect(placeholder).not.toBeNull();
    expect(placeholder.textContent).toBe('Nenhuma etiqueta cabe nesta folha.');
    expect(container.querySelector('[data-sheet-surface]')).toBeNull();
    expect(container.querySelector('[data-sheet-count]')).toBeNull();
    expect(container.querySelector('input[name="escala-folha"]')).toBeNull();
    expect(generateSymbol).not.toHaveBeenCalled();
  });
});

describe('produto com simbolo recusado', () => {
  it('vai para a folha com o marcador de falha, e as demais etiquetas seguem', async () => {
    await render({
      items: [
        { productId: ARMARIO.id, copies: 1 },
        { productId: RECUSADO.id, copies: 2 },
      ],
    });

    expect(cells()).toHaveLength(3);
    expect(cells()[0].querySelector('[data-symbol-state="ready"]')).not.toBeNull();

    const recusadas = cells().slice(1);

    recusadas.forEach((cell) => {
      expect(cell.dataset.productId).toBe(RECUSADO.id);
      expect(cell.textContent).toContain('Sem símbolo');
      expect(cell.textContent).toContain('FOG-00999');
      expect(cell.querySelector('[data-symbol-state="ready"]')).toBeNull();
    });
  });
});

describe('simbolo ainda em geracao', () => {
  it('reserva a caixa do simbolo em cada etiqueta enquanto espera', async () => {
    generateSymbol.mockImplementation(() => new Promise(() => {}));

    await render({ items: [{ productId: ARMARIO.id, copies: 2 }] });

    expect(cells()).toHaveLength(2);
    expect(container.querySelectorAll('[data-symbol-state="pending"]')).toHaveLength(2);
  });
});
