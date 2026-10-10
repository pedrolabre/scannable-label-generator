// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_LABEL_SETTINGS } from '../../domain/schemas/labelSettingsSchema.js';
import { LABEL_SETTINGS_STORAGE_KEY } from '../../storage/labelSettingsStorage.js';
import { useLabelSettingsStore } from '../../store/useLabelSettingsStore.js';
import { usePrintJobStore } from '../../store/usePrintJobStore.js';

import SheetPreviewDialog from './SheetPreviewDialog.jsx';
import { usePrintJobState } from './printJobState.js';
import { usePrintExport } from './usePrintExport.js';

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

const PRODUCTS = [ARMARIO];

let container;
let root;
let onClose;

function Dialogo() {
  const printState = usePrintJobState(PRODUCTS);
  const exporter = usePrintExport();

  return (
    <SheetPreviewDialog
      printState={printState}
      products={PRODUCTS}
      exporter={exporter}
      onClose={onClose}
    />
  );
}

beforeEach(async () => {
  window.localStorage.clear();
  useLabelSettingsStore.setState({ settings: { ...DEFAULT_LABEL_SETTINGS } });
  usePrintJobStore.getState().resetPrintJob();
  usePrintJobStore.getState().toggleProduct(ARMARIO.id);
  onClose = vi.fn();

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<Dialogo />);
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

function dialog() {
  return container.querySelector('[role="dialog"]');
}

// Classes que fazem um elemento rolar. A moldura do dialogo usa
// `overflow-hidden`, que corta e nao rola, e por isso fica de fora.
const SCROLLING = /(^|\s)overflow(-[xy])?-(auto|scroll)(\s|$)/;

describe('dialogo da folha', () => {
  it('abre com o titulo proprio, na largura e na altura do desenho', () => {
    expect(dialog().querySelector('h2').textContent).toBe('Prévia da folha');
    expect(dialog().style.width).toBe('1160px');
    expect(dialog().style.height).toBe('760px');
  });

  it('tem a mesa da folha como o unico elemento que rola', () => {
    const rolaveis = [dialog(), ...dialog().querySelectorAll('*')].filter((element) =>
      SCROLLING.test(element.getAttribute('class') ?? ''),
    );

    expect(rolaveis).toHaveLength(1);
    expect(rolaveis[0].hasAttribute('data-sheet-table')).toBe(true);
    expect(rolaveis[0].contains(dialog().querySelector('[data-sheet-surface]'))).toBe(true);
  });

  it('comeca pela metade e passa a tamanho real pelo seletor do cabecalho', async () => {
    const surface = () => dialog().querySelector('[data-sheet-surface]');

    expect(surface().style.transform).toBe('scale(0.5)');

    const umPorUm = dialog().querySelector('header input[name="escala-folha"][value="1"]');

    await act(async () => {
      umPorUm.click();
    });

    expect(surface().style.transform).toBe('scale(1)');
    expect(surface().style.width).toBe('210mm');
  });

  it('troca a borda de corte pela ficha, desenha a folha com ela e guarda a escolha', async () => {
    const ficha = dialog().querySelector('aside[aria-label="Ficha da folha"]');
    const surfaces = () => [...dialog().querySelectorAll('[data-label-surface]')];

    expect(ficha.querySelector('legend').textContent).toBe('Borda de corte');
    expect(ficha.querySelector('input[name="borda-corte"][value="clara"]').checked).toBe(true);
    expect(surfaces().every((surface) => surface.dataset.cutGuide === 'clara')).toBe(true);

    await act(async () => {
      ficha.querySelector('input[name="borda-corte"][value="destacada"]').click();
    });

    expect(surfaces().length).toBeGreaterThan(0);
    surfaces().forEach((surface) => {
      expect(surface.dataset.cutGuide).toBe('destacada');
      expect(surface.style.outlineWidth).toBe('0.2mm');
    });
    expect(JSON.parse(window.localStorage.getItem(LABEL_SETTINGS_STORAGE_KEY)).cutGuide).toBe('destacada');
  });

  it('fecha pelo botao da ficha e exporta pelo mesmo pe de acoes da coluna', async () => {
    const ficha = dialog().querySelector('aside[aria-label="Ficha da folha"]');
    const botoes = [...ficha.querySelectorAll('button')].map((botao) => botao.textContent);

    expect(botoes.slice(-2)).toEqual(['Fechar', 'Exportar PDF']);
    expect(ficha.querySelector('[data-export-button]').disabled).toBe(false);

    const fechar = [...ficha.querySelectorAll('button')].find(
      (botao) => botao.textContent === 'Fechar',
    );

    await act(async () => {
      fechar.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
