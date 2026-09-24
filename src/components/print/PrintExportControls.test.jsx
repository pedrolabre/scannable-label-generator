// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_LABEL_SETTINGS } from '../../domain/schemas/labelSettingsSchema.js';
import { findLabelLayout } from '../../domain/services/labelLayoutCatalog.js';
import { MAX_EXPORT_LABELS } from '../../domain/services/printExport.js';
import { computeSheetGrid } from '../../domain/services/sheetGrid.js';
import { findSheetLayout } from '../../domain/services/sheetLayoutCatalog.js';
import { BARCODE_ERROR_CODES, BarcodeError } from '../../lib/barcodeError.js';
import { useLabelSettingsStore } from '../../store/useLabelSettingsStore.js';

import PrintExportControls from './PrintExportControls.jsx';
import { usePrintExport } from './usePrintExport.js';

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

function symbolFor(text) {
  return Object.freeze({
    text,
    symbology: 'qrcode',
    errorCorrectionLevel: 'M',
    moduleCount: 21,
    quietZoneModules: 4,
    totalModules: 29,
    svg: '<svg viewBox="0 0 58 58"><path d="M8 8L22 8L22 22L8 22Z" /></svg>',
  });
}

let container;
let root;

beforeEach(() => {
  generateSymbol.mockImplementation(async (text) => {
    if (text.split('|')[1] === FOGAO.systemCode) {
      throw new BarcodeError(BARCODE_ERROR_CODES.UNSUPPORTED_CHARACTER, 'Código sem símbolo.');
    }

    return symbolFor(text);
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

/**
 * A exportacao e criada uma vez por quem monta a tela e entregue aos dois
 * lugares que exportam. O mesmo arranjo e montado aqui: um `exporter`, e um ou
 * dois conjuntos de botoes sobre ele.
 */
function Controles({ items, ready, twice }) {
  const exporter = usePrintExport();
  const grid = computeSheetGrid(RETRATO, GRANDE);
  const request = ready
    ? {
        job: { labelLayoutId: GRANDE.id, sheetLayoutId: RETRATO.id, items },
        sheet: RETRATO,
        labelLayout: GRANDE,
        grid,
        products: PRODUCTS,
      }
    : null;

  return (
    <>
      <div data-lugar="coluna">
        <PrintExportControls
          exporter={exporter}
          request={request}
          leadingAction={<button type="button">Prévia da folha</button>}
        />
      </div>
      {twice ? (
        <div data-lugar="dialogo">
          <PrintExportControls exporter={exporter} request={request} />
        </div>
      ) : null}
    </>
  );
}

async function render({ items, ready = true, twice = false }) {
  await act(async () => {
    root.render(<Controles items={items} ready={ready} twice={twice} />);
  });
}

function button(lugar = 'coluna') {
  return container.querySelector(`[data-lugar="${lugar}"] [data-export-button]`);
}

async function click(target) {
  await act(async () => {
    target.click();
  });
}

describe('botao de exportar', () => {
  it('mostra o botao disponivel abaixo da acao que vem antes dele', async () => {
    await render({ items: [{ productId: ARMARIO.id, copies: 2 }] });

    const botoes = [...container.querySelectorAll('[data-lugar="coluna"] button')];

    expect(botoes.map((botao) => botao.textContent)).toEqual(['Prévia da folha', 'Exportar PDF']);
    expect(button().disabled).toBe(false);
  });

  it('fica desabilitado quando a configuracao nao permite exportar', async () => {
    await render({ items: [{ productId: ARMARIO.id, copies: 2 }], ready: false });

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
  it('gera um simbolo por exemplar da tiragem e dispara o download', async () => {
    await render({
      items: [
        { productId: ARMARIO.id, copies: 3 },
        { productId: FOGAO.id, copies: 2 },
      ],
    });

    await click(button());

    // Cinco etiquetas, cinco exemplares: cada copia grava o proprio numero.
    expect(generateSymbol).toHaveBeenCalledTimes(5);
    expect(generateSymbol.mock.calls.map(([text]) => text.split('|')[6])).toEqual([
      'c1',
      'c2',
      'c3',
      'c1',
      'c2',
    ]);
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

    expect(container.querySelector('[data-export-progress]').textContent).toBe(
      'Gerando folha 2 de 4…',
    );
    expect(button().textContent).toBe('Exportando…');
    expect(button().disabled).toBe(true);
    expect(downloadBlob).not.toHaveBeenCalled();

    await act(async () => {
      releaseRender();
    });

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(button().disabled).toBe(false);
    expect(container.querySelector('[data-export-progress]')).toBeNull();
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

  it('leva ao documento o nome da empresa e o parcelamento guardados', async () => {
    useLabelSettingsStore.setState({
      settings: {
        companyName: 'Loja Inventada',
        showCompanyName: true,
        installmentText: '10x no cartão',
        showInstallmentText: true,
      },
    });

    await render({ items: [{ productId: ARMARIO.id, copies: 1 }] });
    await click(button());

    const [description] = renderPrintDocument.mock.calls[0];
    const texts = description.pages[0].ops.filter((op) => op.type === 'text').map((op) => op.text);

    expect(texts).toContain('Loja Inventada');
    expect(texts).toContain('10x no cartão');

    await act(async () => {
      useLabelSettingsStore.setState({ settings: { ...DEFAULT_LABEL_SETTINGS } });
    });
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

describe('dois lugares, um caminho', () => {
  it('acompanha no segundo lugar a exportacao disparada no primeiro', async () => {
    let releaseRender;

    renderPrintDocument.mockImplementation(async (description, { onProgress }) => {
      onProgress(1, 4);

      await new Promise((resolve) => {
        releaseRender = resolve;
      });

      return new Uint8Array([1]);
    });

    await render({ items: [{ productId: ARMARIO.id, copies: 10 }], twice: true });

    await click(button('dialogo'));

    expect(button('coluna').textContent).toBe('Exportando…');
    expect(button('coluna').disabled).toBe(true);
    expect(container.querySelectorAll('[data-export-progress]')).toHaveLength(2);

    await click(button('coluna'));

    expect(renderPrintDocument).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseRender();
    });

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(button('coluna').disabled).toBe(false);
    expect(button('dialogo').disabled).toBe(false);
  });

  it('segura o teto nos dois lugares', async () => {
    await render({
      items: [{ productId: ARMARIO.id, copies: MAX_EXPORT_LABELS + 1 }],
      twice: true,
    });

    expect(button('coluna').disabled).toBe(true);
    expect(button('dialogo').disabled).toBe(true);
    expect(container.querySelectorAll('[data-export-limit]')).toHaveLength(2);
  });
});
