// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_NUMERIC_LENGTH } from '../../lib/barcodeSymbology.js';
import { usePrintJobStore } from '../../store/usePrintJobStore.js';

import PrintJobPanel from './PrintJobPanel.jsx';

// O painel pronto desenha a folha, e a folha pede os simbolos. O duble responde
// na hora e deixa a biblioteca do simbolo fora deste arquivo.
const generateSymbol = vi.hoisted(() =>
  vi.fn(async (systemCode) => ({
    systemCode,
    moduleCount: 21,
    quietZoneModules: 4,
    totalModules: 29,
    svg: '<svg viewBox="0 0 58 58"></svg>',
  })),
);

vi.mock('../../lib/barcode.js', () => ({ generateSymbol }));

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

// Comprimento e a unica porta por onde a impossibilidade entra: todo caractere
// aceito pelo contrato do produto e codificavel.
const SEM_SIMBOLO = {
  id: '33333333-3333-4333-8333-333333333333',
  systemCode: '9'.repeat(MAX_NUMERIC_LENGTH + 1),
  displayName: 'Fogão cinco bocas',
  priceInCentavos: 219900,
};

let container;
let root;

beforeEach(() => {
  // O store e singleton de modulo, e o Vitest isola por arquivo e nao por teste:
  // sem este reinicio a selecao de um teste chegaria ao seguinte.
  usePrintJobStore.getState().resetPrintJob();

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

async function render(element) {
  await act(async () => {
    root.render(element);
  });
}

async function select(productId) {
  await act(async () => {
    usePrintJobStore.getState().toggleProduct(productId);
  });
}

async function type(selector, value) {
  const input = container.querySelector(selector);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function status() {
  return container.querySelector('[data-print-status]');
}

describe('catalogo vazio', () => {
  it('pede produtos antes de falar em folha', async () => {
    await render(<PrintJobPanel products={[]} />);

    expect(container.querySelector('[data-print-state="empty-catalog"]')).not.toBeNull();
  });
});

describe('selecao multipla', () => {
  it('cobra a selecao enquanto nada esta marcado', async () => {
    await render(<PrintJobPanel products={[ARMARIO, GELADEIRA]} />);

    expect(container.querySelector('[data-print-state="no-selection"]')).not.toBeNull();
    expect(status().dataset.printStatus).toBe('blocked');
    expect(status().textContent).toContain('Selecione ao menos um produto para imprimir');
  });

  it('leva a quantidade digitada de cada produto ao trabalho', async () => {
    await render(<PrintJobPanel products={[ARMARIO, GELADEIRA]} />);

    await select(ARMARIO.id);
    await select(GELADEIRA.id);

    expect(container.querySelectorAll('[data-print-item]')).toHaveLength(2);

    await type(`#copias-${GELADEIRA.id}`, '12');

    expect(status().dataset.printStatus).toBe('ready');
    expect(status().textContent).toBe('Configuração pronta: 13 etiquetas em 2 produtos.');
  });

  it('larga o produto removido da listagem e mantem o restante da selecao', async () => {
    await render(<PrintJobPanel products={[ARMARIO, GELADEIRA]} />);

    await select(ARMARIO.id);
    await select(GELADEIRA.id);

    await render(<PrintJobPanel products={[ARMARIO]} />);

    expect(container.querySelector(`[data-print-item="${GELADEIRA.id}"]`)).toBeNull();
    expect(container.querySelector(`[data-print-item="${ARMARIO.id}"]`)).not.toBeNull();
    expect(status().textContent).toBe('Configuração pronta: 1 etiqueta em 1 produto.');
  });
});

describe('quantidade por produto', () => {
  it('bloqueia o trabalho quando a quantidade nao vale', async () => {
    await render(<PrintJobPanel products={[ARMARIO]} />);
    await select(ARMARIO.id);

    await type(`#copias-${ARMARIO.id}`, '0');

    expect(container.querySelector(`#copias-${ARMARIO.id}-error`).textContent).toBe(
      'Quantidade de etiquetas deve ser maior que zero',
    );
    expect(status().dataset.printStatus).toBe('blocked');
  });

  it('nao completa sozinho o campo apagado', async () => {
    await render(<PrintJobPanel products={[ARMARIO]} />);
    await select(ARMARIO.id);

    await type(`#copias-${ARMARIO.id}`, '');

    expect(container.querySelector(`#copias-${ARMARIO.id}`).value).toBe('');
    expect(status().textContent).toContain('Informe a quantidade de etiquetas');
  });
});

describe('configuracao da folha', () => {
  it('parte do modelo escolhido e repoe os numeros ao trocar de folha', async () => {
    await render(<PrintJobPanel products={[ARMARIO]} />);

    await type('#folha-marginTopMm', '4');
    expect(container.querySelector('#folha-marginTopMm').value).toBe('4');

    const paisagem = container.querySelector('input[name="modelo-folha"][value="a4-paisagem"]');

    await act(async () => {
      paisagem.click();
    });

    expect(container.querySelector('#folha-marginTopMm').value).toBe('10');
  });

  it('recusa a configuracao invalida com a mensagem que o operador le', async () => {
    await render(<PrintJobPanel products={[ARMARIO]} />);
    await select(ARMARIO.id);

    await type('#folha-marginLeftMm', '80');

    expect(container.querySelector('#folha-marginLeftMm-error').textContent).toBe(
      'Margem esquerda deve ser no máximo 50 mm',
    );
    expect(status().dataset.printStatus).toBe('blocked');
    expect(status().textContent).toContain('Margem esquerda deve ser no máximo 50 mm');
  });
});

describe('produto sem simbolo', () => {
  it('entra na selecao com aviso, e nao bloqueia o trabalho', async () => {
    await render(<PrintJobPanel products={[ARMARIO, SEM_SIMBOLO]} />);

    await select(ARMARIO.id);
    await select(SEM_SIMBOLO.id);

    const row = container.querySelector(`[data-print-item="${SEM_SIMBOLO.id}"]`);

    expect(row.dataset.symbolSupport).toBe('unsupported');
    expect(container.querySelector('[data-symbol-warning]').textContent).toContain(
      '1 produto selecionado não gera símbolo',
    );
    expect(status().dataset.printStatus).toBe('ready');
  });
});

describe('previa da folha', () => {
  it('aparece quando a configuracao esta pronta e some quando ela e recusada', async () => {
    await render(<PrintJobPanel products={[ARMARIO]} />);

    expect(container.querySelector('[data-sheet-preview]')).toBeNull();

    await select(ARMARIO.id);

    expect(container.querySelector('[data-sheet-preview]')).not.toBeNull();
    expect(container.querySelectorAll('[data-sheet-cell]')).toHaveLength(1);

    await type(`#copias-${ARMARIO.id}`, '0');

    expect(container.querySelector('[data-sheet-preview]')).toBeNull();
  });

  it('acompanha a margem digitada e o modelo escolhido', async () => {
    await render(<PrintJobPanel products={[ARMARIO]} />);
    await select(ARMARIO.id);

    await type('#folha-marginLeftMm', '25,5');

    expect(container.querySelector('[data-sheet-cell="0"]').style.left).toBe('25.5mm');
    expect(container.querySelector('[data-sheet-usable-area]').style.left).toBe('25.5mm');

    const pequena = container.querySelector(
      'input[name="modelo-etiqueta-impressao"][value="etiqueta-pequena"]',
    );

    await act(async () => {
      pequena.click();
    });

    // Largura util 210 - 25,5 - 10 = 174,5: tres colunas de 50 com 3 de espaco.
    expect(container.querySelector('[data-sheet-count]').textContent).toBe(
      '1 etiqueta numa folha que comporta 24 etiquetas.',
    );
  });

  it('avisa quantas folhas a selecao ocupa', async () => {
    await render(<PrintJobPanel products={[ARMARIO, GELADEIRA]} />);
    await select(ARMARIO.id);
    await select(GELADEIRA.id);

    // Tag grande em A4 retrato: 3 por folha; 4 + 3 = 7 etiquetas, 3 folhas.
    await type(`#copias-${ARMARIO.id}`, '4');
    await type(`#copias-${GELADEIRA.id}`, '3');

    const count = container.querySelector('[data-sheet-count]');

    expect(count.dataset.sheetCount).toBe('3');
    expect(count.textContent).toBe('A seleção ocupa 3 folhas: 7 etiquetas, 3 por folha.');
    expect(status().dataset.printStatus).toBe('ready');
  });
});

describe('exportacao em PDF', () => {
  it('oferece a acao de exportar quando a configuracao vale, e a recolhe quando ela e recusada', async () => {
    await render(<PrintJobPanel products={[ARMARIO]} />);

    expect(container.querySelector('[data-export-button]')).toBeNull();

    await select(ARMARIO.id);

    expect(container.querySelector('[data-export-button]').textContent).toBe('Exportar PDF');
    expect(container.querySelector('[data-export-button]').disabled).toBe(false);

    await type('#folha-marginLeftMm', '80');

    expect(container.querySelector('[data-export-button]')).toBeNull();
    expect(status().dataset.printStatus).toBe('blocked');
  });
});
