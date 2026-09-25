// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_LABEL_SETTINGS } from '../../domain/schemas/labelSettingsSchema.js';
import { findLabelLayout } from '../../domain/services/labelLayoutCatalog.js';
import { LOGO_MESSAGES, LogoImageError, resolveLogo } from '../../domain/services/logoImage.js';
import { computeSheetGrid } from '../../domain/services/sheetGrid.js';
import { findSheetLayout } from '../../domain/services/sheetLayoutCatalog.js';
import { pngDataUrl } from '../../lib/logoFixtures.js';
import { LABEL_SETTINGS_STORAGE_KEY, STORAGE_FULL_MESSAGE } from '../../storage/labelSettingsStorage.js';
import { useLabelSettingsStore } from '../../store/useLabelSettingsStore.js';
import SheetCanvas from '../print/SheetCanvas.jsx';

import LabelPreviewPanel from './LabelPreviewPanel.jsx';

const generateSymbol = vi.hoisted(() => vi.fn());
const prepareLogo = vi.hoisted(() => vi.fn());

vi.mock('../../lib/barcode.js', () => ({ generateSymbol }));
vi.mock('../../lib/logoFile.js', () => ({ prepareLogo }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PRODUCT = {
  id: '6f0f3f3a-6f4f-4f4a-8f4a-6f4f4f4a8f4a',
  systemCode: 'MOV-00412',
  displayName: 'Guarda-roupa seis portas',
  priceInCentavos: 189990,
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
};

const FIRST_LOGO = pngDataUrl(300, 60);
const SECOND_LOGO = pngDataUrl(90, 90, [20, 20, 20]);

let container;
let root;

beforeEach(() => {
  window.localStorage.clear();
  useLabelSettingsStore.setState({
    settings: { ...DEFAULT_LABEL_SETTINGS, companyName: 'Loja Inventada' },
  });
  generateSymbol.mockReturnValue(new Promise(() => {}));
  prepareLogo.mockResolvedValue(FIRST_LOGO);

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
  prepareLogo.mockReset();
  vi.restoreAllMocks();
});

async function mount(layoutId = 'etiqueta-media-10') {
  await act(async () => {
    root.render(
      <LabelPreviewPanel product={PRODUCT} hasProducts layoutId={layoutId} onLayoutChange={() => {}} />,
    );
  });
}

function control() {
  return container.querySelector('[data-label-logo-setting]');
}

function button(text) {
  return [...control().querySelectorAll('button')].find((node) => node.textContent === text);
}

function zone(role) {
  return container.querySelector(`[data-label-surface] [data-label-zone="${role}"]`);
}

function stored() {
  return JSON.parse(window.localStorage.getItem(LABEL_SETTINGS_STORAGE_KEY) ?? 'null');
}

async function choose(file = new File(['x'], 'marca.png', { type: 'image/png' })) {
  const input = control().querySelector('input[type="file"]');

  Object.defineProperty(input, 'files', { configurable: true, value: [file] });

  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  return file;
}

async function click(target) {
  await act(async () => {
    target.click();
  });
}

describe('controle de logotipo', () => {
  it('fica na secao da etiqueta, vazio, com o nome da empresa no cabecalho', async () => {
    await mount();

    const section = container.querySelector('section[data-label-text-settings]');

    expect(section.getAttribute('aria-label')).toBe('Logotipo e textos da etiqueta');
    expect(section.contains(control())).toBe(true);
    expect(control().dataset.logoState).toBe('empty');
    expect(button('Carregar logotipo')).toBeTruthy();
    expect(control().querySelector('input[type="file"]').accept).toContain('image/svg+xml');
    expect(zone('logo')).toBeNull();
    expect(zone('company').textContent).toBe('Loja Inventada');
  });

  it('carrega o arquivo, mostra a miniatura e poe o logotipo no lugar do nome', async () => {
    await mount();
    const file = await choose();

    expect(prepareLogo).toHaveBeenCalledWith(file);
    expect(control().dataset.logoState).toBe('saved');
    expect(control().querySelector('[data-logo-thumbnail]').getAttribute('src')).toBe(FIRST_LOGO);
    expect(zone('logo').getAttribute('src')).toBe(FIRST_LOGO);
    expect(zone('company')).toBeNull();
    expect(stored().logoDataUrl).toBe(FIRST_LOGO);
  });

  it('troca o logotipo guardado pelo novo', async () => {
    await mount();
    await choose();
    prepareLogo.mockResolvedValue(SECOND_LOGO);
    await choose(new File(['y'], 'outra.svg', { type: 'image/svg+xml' }));

    expect(button('Trocar')).toBeTruthy();
    expect(zone('logo').getAttribute('src')).toBe(SECOND_LOGO);
    expect(stored().logoDataUrl).toBe(SECOND_LOGO);
  });

  it('desmarcar a caixa tira o logotipo da etiqueta, devolve o nome e guarda o estado', async () => {
    await mount();
    await choose();

    await click(control().querySelector('input[type="checkbox"]'));

    expect(zone('logo')).toBeNull();
    expect(zone('company').textContent).toBe('Loja Inventada');
    expect(stored()).toMatchObject({ logoDataUrl: FIRST_LOGO, showLogo: false });

    // Uma nova abertura le o que ficou guardado, com a caixa desmarcada.
    useLabelSettingsStore.setState({ settings: { ...DEFAULT_LABEL_SETTINGS } });
    await act(async () => {
      useLabelSettingsStore.getState().reload();
    });

    expect(control().querySelector('input[type="checkbox"]').checked).toBe(false);
    expect(control().querySelector('[data-logo-thumbnail]').getAttribute('src')).toBe(FIRST_LOGO);
  });

  it('remover apaga o logotipo guardado e devolve a etiqueta de antes', async () => {
    await mount();
    await choose();
    await click(button('Remover'));

    expect(control().dataset.logoState).toBe('empty');
    expect(zone('logo')).toBeNull();
    expect(zone('company').textContent).toBe('Loja Inventada');
    expect(stored().logoDataUrl).toBe('');
  });

  it('recusa o arquivo com a frase do motivo e nao grava nada', async () => {
    prepareLogo.mockRejectedValue(new LogoImageError(LOGO_MESSAGES.sourceType));
    await mount();
    await choose(new File(['x'], 'marca.gif', { type: 'image/gif' }));

    expect(control().querySelector('[data-logo-error]').textContent).toBe(LOGO_MESSAGES.sourceType);
    expect(control().dataset.logoState).toBe('empty');
    expect(stored()).toBeNull();
  });

  it('mostra a falha de gravacao e mantem o logotipo que estava guardado', async () => {
    await mount();
    await choose();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });
    prepareLogo.mockResolvedValue(SECOND_LOGO);
    await choose();

    expect(control().querySelector('[data-logo-error]').textContent).toBe(STORAGE_FULL_MESSAGE);
    expect(zone('logo').getAttribute('src')).toBe(FIRST_LOGO);
  });

  it('na etiqueta pequena, o nome da empresa continua e o logotipo nao entra', async () => {
    await mount('etiqueta-pequena');
    await choose();

    expect(zone('logo')).toBeNull();
    expect(zone('company').textContent).toBe('Loja Inventada');
  });
});

describe('logotipo na folha', () => {
  it('sai em cada etiqueta da folha, com a mesma imagem da previa', async () => {
    const sheet = findSheetLayout('a4-10-etiquetas');
    const labelLayout = findLabelLayout('etiqueta-media-10');
    const grid = computeSheetGrid(sheet, labelLayout);
    const slots = grid.cells.map((cell, index) => ({
      cell,
      product: PRODUCT,
      copyNumber: index + 1,
      symbolText: null,
      symbolError: null,
    }));

    await act(async () => {
      root.render(
        <SheetCanvas
          sheet={sheet}
          labelLayout={labelLayout}
          slots={slots}
          symbols={new Map()}
          header={{ companyName: 'Loja Inventada', installmentText: null, logo: resolveLogo(FIRST_LOGO) }}
        />,
      );
    });

    const logos = container.querySelectorAll('[data-label-zone="logo"]');

    expect(logos).toHaveLength(10);
    expect([...logos].every((node) => node.getAttribute('src') === FIRST_LOGO)).toBe(true);
    expect(container.querySelectorAll('[data-label-zone="company"]')).toHaveLength(0);
  });
});
