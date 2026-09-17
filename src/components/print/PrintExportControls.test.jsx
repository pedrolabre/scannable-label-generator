// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findLabelLayout } from '../../domain/services/labelLayoutCatalog.js';
import { MAX_EXPORT_LABELS } from '../../domain/services/printExport.js';
import { computeSheetGrid } from '../../domain/services/sheetGrid.js';
import { findSheetLayout } from '../../domain/services/sheetLayoutCatalog.js';
import { BARCODE_ERROR_CODES, BarcodeError } from '../../lib/barcodeError.js';

import PrintExportControls from './PrintExportControls.jsx';

/**
 * A geracao do PDF e o download entram dublados: o que se prova aqui e a tela —
 * o rotulo do botao, quando ele fica desabilitado, o que o operador le enquanto
 * espera e o que ele le quando a geracao falha. O arquivo em si e conferido em
 * `src/lib/pdf.test.js`, sobre os bytes de verdade.
 */

const generateSymbol = vi.hoisted(() => vi.fn());
const renderPrintDocument = vi.hoisted(() => vi.fn());
const downloadBlob = vi.hoisted(() => vi.fn());

vi.mock('../../lib/barcode.js', () => ({ generateSymbol }));
vi.mock('../../lib/pdf.js', () => ({ renderPrintDocument }));
vi.mock('../../lib/download.js', () => ({ downloadBlob }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const RETRATO = findSheetLayout('a4-retrato');
const GRANDE = findLabelLayout('tag-grande');

const ARMARIO = {
  id: '11111111-1111-4111-8111-111111111111',
  systemCode: 'MOV-00412',
  displayName: 'Armário de cozinha',
  priceInCentavos: 89990,
};

const FOGAO = {
  id: '22222222-2222-4222-8222-222222222222',
  systemCode: 'FOG-00999',
  displayName: 'Fogão cinco bocas',
  priceInCentavos: 219900,
};

const PRODUCTS = [ARMARIO, FOGAO];

function symbolFor(systemCode) {
  return Object.freeze({
    systemCode,
    symbology: 'qrcode',
    errorCorrectionLevel: 'Q',
    moduleCount: 21,
    quietZoneModules: 4,
    totalModules: 29,
    svg: '<svg viewBox="0 0 58 58"><path d="M8 8L22 8L22 22L8 22Z" /></svg>',
  });
}

let container;
let root;

beforeEach(() => {
  generateSymbol.mockImplementation(async (systemCode) => {
    if (systemCode === FOGAO.systemCode) {
      throw new BarcodeError(BARCODE_ERROR_CODES.UNSUPPORTED_CHARACTER, 'Código sem símbolo.');
    }

    return symbolFor(systemCode);
  });

  renderPrintDocument.mockResolvedValue(new Uint8Array([1, 2, 3]));

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
  renderPrintDocument.mockReset();
  downloadBlob.mockReset();
});

async function render({ items, canExport = true }) {
  const grid = computeSheetGrid(RETRATO, GRANDE);

  await act(async () => {
    root.render(
      <PrintExportControls
        job={{ labelLayoutId: GRANDE.id, sheetLayoutId: RETRATO.id, items }}
        sheet={RETRATO}
        labelLayout={GRANDE}
        grid={grid}
        products={PRODUCTS}
        canExport={canExport}
        readyMessage="Configuração pronta: 2 etiquetas em 1 produto."
      />,
    );
  });
}

function button() {
  return container.querySelector('[data-export-button]');
}

async function click(target) {
  await act(async () => {
    target.click();
  });
}

describe('botao de exportar', () => {
  it('mostra a linha de estado e o botao disponivel', async () => {
    await render({ items: [{ productId: ARMARIO.id, copies: 2 }] });

    expect(container.querySelector('[data-print-status]').textContent).toBe(
      'Configuração pronta: 2 etiquetas em 1 produto.',
    );
    expect(button().textContent).toBe('Exportar PDF');
    expect(button().disabled).toBe(false);
  });

  it('fica desabilitado quando a configuracao nao permite exportar', async () => {
    await render({ items: [{ productId: ARMARIO.id, copies: 2 }], canExport: false });

    expect(button().disabled).toBe(true);
  });

  it('fica desabilitado e explica quando a tiragem passa do teto', async () => {
    await render({ items: [{ productId: ARMARIO.id, copies: MAX_EXPORT_LABELS + 1 }] });

    expect(button().disabled).toBe(true);
    expect(container.querySelector('[data-export-limit]').textContent).toBe(
      `A seleção tem ${MAX_EXPORT_LABELS + 1} etiquetas e o limite de exportação é ` +
        `${MAX_EXPORT_LABELS}. Reduza as cópias ou exporte em partes.`,
    );
  });
});

describe('exportacao', () => {
  it('gera um simbolo por codigo da tiragem e dispara o download', async () => {
    await render({
      items: [
        { productId: ARMARIO.id, copies: 3 },
        { productId: FOGAO.id, copies: 2 },
      ],
    });

    await click(button());

    // Cinco etiquetas, dois codigos: um simbolo por codigo, e nao por etiqueta.
    expect(generateSymbol).toHaveBeenCalledTimes(2);
    expect(renderPrintDocument).toHaveBeenCalledTimes(1);
    expect(downloadBlob).toHaveBeenCalledTimes(1);

    const [, fileName] = downloadBlob.mock.calls[0];

    expect(fileName).toMatch(/^labelforge-etiquetas-\d{4}-\d{2}-\d{2}-tag-grande\.pdf$/);
  });

  it('exporta a tiragem inteira, e nao so a folha a vista', async () => {
    await render({ items: [{ productId: ARMARIO.id, copies: 10 }] });

    await click(button());

    // Tag grande em A4 retrato: 3 por folha; 10 etiquetas ocupam 4 folhas.
    const [description] = renderPrintDocument.mock.calls[0];

    expect(description.pages).toHaveLength(4);
  });

  it('mostra a folha em que a geracao esta, e segura o botao enquanto espera', async () => {
    let releaseRender;

    renderPrintDocument.mockImplementation(async (description, { onProgress }) => {
      onProgress(2, 4);

      await new Promise((resolve) => {
        releaseRender = resolve;
      });

      return new Uint8Array([1]);
    });

    await render({ items: [{ productId: ARMARIO.id, copies: 10 }] });

    await click(button());

    expect(container.querySelector('[data-print-status]').dataset.printStatus).toBe('exporting');
    expect(container.querySelector('[data-print-status]').textContent).toBe('Gerando folha 2 de 4…');
    expect(button().textContent).toBe('Exportando…');
    expect(button().disabled).toBe(true);
    expect(downloadBlob).not.toHaveBeenCalled();

    await act(async () => {
      releaseRender();
    });

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(button().disabled).toBe(false);
    expect(container.querySelector('[data-print-status]').textContent).toBe(
      'Configuração pronta: 2 etiquetas em 1 produto.',
    );
  });

  it('avisa quando a geracao falha, e libera o botao', async () => {
    renderPrintDocument.mockRejectedValue(new Error('motor indisponivel'));

    await render({ items: [{ productId: ARMARIO.id, copies: 1 }] });

    await click(button());

    expect(container.querySelector('[data-export-status="failed"]').textContent).toContain(
      'Não foi possível gerar o PDF das etiquetas. Tente de novo.',
    );
    expect(button().disabled).toBe(false);
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('exporta o produto sem simbolo junto com os demais', async () => {
    await render({ items: [{ productId: FOGAO.id, copies: 1 }] });

    await click(button());

    const [description] = renderPrintDocument.mock.calls[0];
    const texts = description.pages[0].ops.filter((op) => op.type === 'text').map((op) => op.text);

    expect(texts).toContain('Sem símbolo');
    expect(texts).toContain('R$ 2.199,00');
    expect(downloadBlob).toHaveBeenCalledTimes(1);
  });
});
