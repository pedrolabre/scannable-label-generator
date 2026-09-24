// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_EXPORT_LABELS } from '../../domain/services/printExport.js';
import { MAX_NUMERIC_LENGTH } from '../../lib/barcodeSymbology.js';
import { usePrintJobStore } from '../../store/usePrintJobStore.js';

import PrintJobSettings from './PrintJobSettings.jsx';
import { usePrintJobState } from './printJobState.js';
import { usePrintExport } from './usePrintExport.js';

// A coluna nao desenha a folha, mas a exportacao que ela dispara pede simbolos.
// O duble responde na hora e deixa a biblioteca do simbolo fora deste arquivo.
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
let openSheetPreview;

/**
 * A leitura do trabalho e a exportacao chegam de quem monta a tela. A coluna e
 * montada aqui com os mesmos dois ganchos que a tela usa.
 */
function Coluna({ products }) {
  const printState = usePrintJobState(products);
  const exporter = usePrintExport();

  return (
    <PrintJobSettings
      products={products}
      printState={printState}
      exporter={exporter}
      onOpenSheetPreview={openSheetPreview}
    />
  );
}

beforeEach(() => {
  // O store e singleton de modulo, e o Vitest isola por arquivo e nao por teste:
  // sem este reinicio a selecao de um teste chegaria ao seguinte.
  usePrintJobStore.getState().resetPrintJob();
  openSheetPreview = vi.fn();

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
    await render(<Coluna products={[]} />);

    expect(container.querySelector('[data-print-state="empty-catalog"]')).not.toBeNull();
  });
});

describe('selecao multipla', () => {
  it('cobra a selecao enquanto nada esta marcado', async () => {
    await render(<Coluna products={[ARMARIO, GELADEIRA]} />);

    expect(container.querySelector('[data-print-state="no-selection"]')).not.toBeNull();
    expect(status().dataset.printStatus).toBe('blocked');
    expect(status().textContent).toContain('Selecione ao menos um produto para imprimir');
  });

  it('leva a quantidade digitada de cada produto ao trabalho', async () => {
    await render(<Coluna products={[ARMARIO, GELADEIRA]} />);

    await select(ARMARIO.id);
    await select(GELADEIRA.id);

    expect(container.querySelectorAll('[data-print-item]')).toHaveLength(2);

    await type(`#copias-${GELADEIRA.id}`, '12');

    expect(status().dataset.printStatus).toBe('ready');
    expect(status().textContent).toBe('Configuração pronta: 13 etiquetas em 2 produtos.');
    // Tag grande em A4 retrato: 3 por folha; 13 etiquetas ocupam 5 folhas.
    expect(container.querySelector('[data-print-sheets]').textContent).toBe('5');
  });

  it('larga o produto removido da listagem e mantem o restante da selecao', async () => {
    await render(<Coluna products={[ARMARIO, GELADEIRA]} />);

    await select(ARMARIO.id);
    await select(GELADEIRA.id);

    await render(<Coluna products={[ARMARIO]} />);

    expect(container.querySelector(`[data-print-item="${GELADEIRA.id}"]`)).toBeNull();
    expect(container.querySelector(`[data-print-item="${ARMARIO.id}"]`)).not.toBeNull();
    expect(status().textContent).toBe('Configuração pronta: 1 etiqueta em 1 produto.');
  });
});

describe('quantidade por produto', () => {
  it('bloqueia o trabalho quando a quantidade nao vale', async () => {
    await render(<Coluna products={[ARMARIO]} />);
    await select(ARMARIO.id);

    await type(`#copias-${ARMARIO.id}`, '0');

    expect(container.querySelector(`#copias-${ARMARIO.id}-error`).textContent).toBe(
      'Quantidade de etiquetas deve ser maior que zero',
    );
    expect(status().dataset.printStatus).toBe('blocked');
  });

  it('nao completa sozinho o campo apagado', async () => {
    await render(<Coluna products={[ARMARIO]} />);
    await select(ARMARIO.id);

    await type(`#copias-${ARMARIO.id}`, '');

    expect(container.querySelector(`#copias-${ARMARIO.id}`).value).toBe('');
    expect(status().textContent).toContain('Informe a quantidade de etiquetas');
  });
});

describe('configuracao da folha', () => {
  it('parte do modelo escolhido e repoe os numeros ao trocar de folha', async () => {
    await render(<Coluna products={[ARMARIO]} />);

    await type('#folha-marginTopMm', '4');
    expect(container.querySelector('#folha-marginTopMm').value).toBe('4');

    const paisagem = container.querySelector('input[name="modelo-folha"][value="a4-paisagem"]');

    await act(async () => {
      paisagem.click();
    });

    expect(container.querySelector('#folha-marginTopMm').value).toBe('10');
  });

  it('recusa a configuracao invalida com a mensagem que o operador le', async () => {
    await render(<Coluna products={[ARMARIO]} />);
    await select(ARMARIO.id);

    await type('#folha-marginLeftMm', '80');

    expect(container.querySelector('#folha-marginLeftMm-error').textContent).toBe(
      'Margem esquerda deve ser no máximo 50 mm',
    );
    expect(status().dataset.printStatus).toBe('blocked');
    expect(status().textContent).toContain('Margem esquerda deve ser no máximo 50 mm');
  });
});

function sheetPreviewButton() {
  return container.querySelector('[data-sheet-preview-trigger]');
}

function exportButton() {
  return container.querySelector('[data-export-button]');
}

describe('contagens', () => {
  it('batem com a selecao guardada no store', async () => {
    await render(<Coluna products={[ARMARIO, GELADEIRA, SEM_SIMBOLO]} />);

    await select(ARMARIO.id);
    await select(SEM_SIMBOLO.id);
    await select(GELADEIRA.id);

    const { selection } = usePrintJobStore.getState();

    expect(container.querySelector('[data-print-selected-count]').dataset.printSelectedCount).toBe(
      String(selection.length),
    );
    expect(container.querySelectorAll('[data-print-item]')).toHaveLength(selection.length);
    expect(container.querySelector('[data-symbol-warning]').dataset.symbolWarning).toBe('1');
    expect(
      container.querySelector(`[data-print-item="${SEM_SIMBOLO.id}"]`).dataset.symbolSupport,
    ).toBe('unsupported');
    // Produto sem simbolo entra com aviso e nao bloqueia o trabalho.
    expect(status().dataset.printStatus).toBe('ready');

    await select(SEM_SIMBOLO.id);

    expect(usePrintJobStore.getState().selection).toHaveLength(2);
    expect(container.querySelector('[data-print-selected-count]').dataset.printSelectedCount).toBe(
      '2',
    );
    expect(container.querySelector('[data-symbol-warning]')).toBeNull();
  });
});

describe('rodape fixo', () => {
  it('traz a previa da folha e a exportacao, nesta ordem, os dois em largura cheia', async () => {
    await render(<Coluna products={[ARMARIO]} />);

    const footer = container.querySelector('section > div:last-child');
    const botoes = [...footer.querySelectorAll('button')];

    expect(botoes.map((botao) => botao.textContent)).toEqual(['Prévia da folha', 'Exportar PDF']);
    botoes.forEach((botao) => expect(botao.className).toContain('w-full'));
    expect(footer.contains(container.querySelector('[data-corpo]'))).toBe(false);
  });

  it('libera a previa da folha so quando a configuracao vale, e pede o dialogo', async () => {
    await render(<Coluna products={[ARMARIO]} />);

    expect(sheetPreviewButton().disabled).toBe(true);

    await select(ARMARIO.id);

    expect(sheetPreviewButton().disabled).toBe(false);

    await act(async () => {
      sheetPreviewButton().click();
    });

    expect(openSheetPreview).toHaveBeenCalledTimes(1);

    await type('#folha-marginLeftMm', '80');

    expect(sheetPreviewButton().disabled).toBe(true);
  });

  it('segura a exportacao quando a configuracao e recusada', async () => {
    await render(<Coluna products={[ARMARIO]} />);

    expect(exportButton().disabled).toBe(true);

    await select(ARMARIO.id);

    expect(exportButton().textContent).toBe('Exportar PDF');
    expect(exportButton().disabled).toBe(false);

    await type('#folha-marginLeftMm', '80');

    expect(exportButton().disabled).toBe(true);
    expect(status().dataset.printStatus).toBe('blocked');
  });

  it('respeita o teto de exportacao e avisa acima dos botoes', async () => {
    // A quantidade por produto para em 999, entao o teto so e alcancado com
    // varios produtos: cinco a 999 ficam em 4.995, o sexto passa de 5.000.
    const lote = Array.from({ length: 6 }, (_, index) => ({
      id: `44444444-4444-4444-8444-44444444444${index}`,
      systemCode: `MOV-0050${index}`,
      displayName: `Estante de aço ${index + 1}`,
      priceInCentavos: 49990,
    }));

    await render(<Coluna products={lote} />);

    for (const produto of lote.slice(0, 5)) {
      await select(produto.id);
      await type(`#copias-${produto.id}`, '999');
    }

    expect(5 * 999).toBeLessThanOrEqual(MAX_EXPORT_LABELS);
    expect(exportButton().disabled).toBe(false);
    expect(container.querySelector('[data-export-limit]')).toBeNull();

    await select(lote[5].id);
    await type(`#copias-${lote[5].id}`, '999');

    const limite = container.querySelector('[data-export-limit]');

    expect(exportButton().disabled).toBe(true);
    expect(limite).not.toBeNull();
    expect(
      limite.compareDocumentPosition(exportButton()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // O teto nao bloqueia o trabalho: a folha continua valendo para conferir.
    expect(status().dataset.printStatus).toBe('ready');
    expect(sheetPreviewButton().disabled).toBe(false);
  });
});
