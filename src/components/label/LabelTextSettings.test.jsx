// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_LABEL_SETTINGS } from '../../domain/schemas/labelSettingsSchema.js';
import { LABEL_SETTINGS_STORAGE_KEY } from '../../storage/labelSettingsStorage.js';
import { useLabelSettingsStore } from '../../store/useLabelSettingsStore.js';

import LabelPreviewPanel from './LabelPreviewPanel.jsx';

const generateSymbol = vi.hoisted(() => vi.fn());

vi.mock('../../lib/barcode.js', () => ({ generateSymbol }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PRODUCT = {
  id: '6f0f3f3a-6f4f-4f4a-8f4a-6f4f4f4a8f4a',
  systemCode: 'MOV-00412',
  displayName: 'Guarda-roupa seis portas',
  priceInCentavos: 189990,
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
};

let container;
let root;

beforeEach(() => {
  window.localStorage.clear();
  useLabelSettingsStore.setState({ settings: { ...DEFAULT_LABEL_SETTINGS } });
  generateSymbol.mockReturnValue(new Promise(() => {}));

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

async function mount() {
  await act(async () => {
    root.render(
      <LabelPreviewPanel product={PRODUCT} hasProducts layoutId="tag-grande" onLayoutChange={() => {}} />,
    );
  });
}

async function unmount() {
  await act(async () => {
    root.unmount();
  });
  root = createRoot(container);
}

function setting(label) {
  return [...container.querySelectorAll('[data-setting-state]')].find((node) =>
    node.textContent.includes(label),
  );
}

function buttonIn(node, text) {
  return [...node.querySelectorAll('button')].find((button) => button.textContent === text);
}

async function typeInto(node, value) {
  const input = node.querySelector('input[type="text"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function click(target) {
  await act(async () => {
    target.click();
  });
}

function zone(role) {
  return container.querySelector(`[data-label-zone="${role}"]`);
}

describe('nome da empresa', () => {
  it('comeca com o campo vazio e sem nome nenhum na etiqueta', async () => {
    await mount();

    expect(setting('Nome da empresa').dataset.settingState).toBe('editing');
    expect(buttonIn(setting('Nome da empresa'), 'Salvar').disabled).toBe(true);
    expect(zone('company')).toBeNull();
  });

  it('salva, aparece no cabecalho da etiqueta e fica guardado no dispositivo', async () => {
    await mount();
    await typeInto(setting('Nome da empresa'), '  Loja Inventada  ');
    await click(buttonIn(setting('Nome da empresa'), 'Salvar'));

    expect(setting('Nome da empresa').dataset.settingState).toBe('saved');
    expect(setting('Nome da empresa').querySelector('[data-setting-value]').textContent).toBe(
      'Loja Inventada',
    );
    expect(zone('company').textContent).toBe('Loja Inventada');
    expect(JSON.parse(window.localStorage.getItem(LABEL_SETTINGS_STORAGE_KEY)).companyName).toBe(
      'Loja Inventada',
    );
  });

  it('sobrevive a uma nova montagem da aplicacao, lida do armazenamento', async () => {
    await mount();
    await typeInto(setting('Nome da empresa'), 'Loja Inventada');
    await click(buttonIn(setting('Nome da empresa'), 'Salvar'));
    await unmount();

    // A memoria volta ao estado de quem acabou de abrir a pagina; o que resta e
    // o que ficou guardado.
    useLabelSettingsStore.setState({ settings: { ...DEFAULT_LABEL_SETTINGS } });
    useLabelSettingsStore.getState().reload();
    await mount();

    expect(setting('Nome da empresa').dataset.settingState).toBe('saved');
    expect(zone('company').textContent).toBe('Loja Inventada');
  });

  it('sai da etiqueta pela caixa de marcacao, sem perder o texto', async () => {
    await mount();
    await typeInto(setting('Nome da empresa'), 'Loja Inventada');
    await click(buttonIn(setting('Nome da empresa'), 'Salvar'));
    await click(setting('Nome da empresa').querySelector('input[type="checkbox"]'));

    expect(zone('company')).toBeNull();
    expect(setting('Nome da empresa').querySelector('[data-setting-value]').textContent).toBe(
      'Loja Inventada',
    );
    expect(useLabelSettingsStore.getState().settings.showCompanyName).toBe(false);
  });

  it('muda pelo botao Alterar e some pelo botao Apagar', async () => {
    await mount();
    await typeInto(setting('Nome da empresa'), 'Loja Inventada');
    await click(buttonIn(setting('Nome da empresa'), 'Salvar'));
    await click(buttonIn(setting('Nome da empresa'), 'Alterar'));

    expect(setting('Nome da empresa').querySelector('input[type="text"]').value).toBe('Loja Inventada');

    await typeInto(setting('Nome da empresa'), 'Outra Loja Inventada');
    await click(buttonIn(setting('Nome da empresa'), 'Salvar'));

    expect(zone('company').textContent).toBe('Outra Loja Inventada');

    await click(buttonIn(setting('Nome da empresa'), 'Apagar'));

    expect(setting('Nome da empresa').dataset.settingState).toBe('editing');
    expect(zone('company')).toBeNull();
    expect(useLabelSettingsStore.getState().settings.companyName).toBe('');
  });

  it('nao grava o rascunho: a etiqueta muda so depois de salvar', async () => {
    await mount();
    await typeInto(setting('Nome da empresa'), 'Loja Inventada');

    expect(zone('company')).toBeNull();
    expect(window.localStorage.getItem(LABEL_SETTINGS_STORAGE_KEY)).toBeNull();
  });
});

describe('armazenamento', () => {
  it('abre com os textos em branco quando o valor guardado esta corrompido', () => {
    window.localStorage.setItem(LABEL_SETTINGS_STORAGE_KEY, '{nao e json');
    useLabelSettingsStore.getState().reload();

    expect(useLabelSettingsStore.getState().settings).toEqual(DEFAULT_LABEL_SETTINGS);
  });
});
