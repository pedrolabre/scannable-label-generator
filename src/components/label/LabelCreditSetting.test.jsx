// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_LABEL_SETTINGS } from '../../domain/schemas/labelSettingsSchema.js';
import {
  INSTALLMENT_COUNT_MESSAGE,
  INTEREST_RATE_DECIMALS_MESSAGE,
  INTEREST_RATE_RANGE_MESSAGE,
} from '../../domain/services/installmentPlan.js';
import { LABEL_SETTINGS_STORAGE_KEY, STORAGE_FULL_MESSAGE } from '../../storage/labelSettingsStorage.js';
import { useLabelSettingsStore } from '../../store/useLabelSettingsStore.js';

import LabelPreviewPanel from './LabelPreviewPanel.jsx';

const generateSymbol = vi.hoisted(() => vi.fn());

vi.mock('../../lib/barcode.js', () => ({ generateSymbol }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PRODUCT = {
  id: '6f0f3f3a-6f4f-4f4a-8f4a-6f4f4f4a8f4a',
  systemCode: 'MOV-00412',
  displayName: 'Guarda-roupa seis portas',
  priceInCentavos: 89990,
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
  vi.restoreAllMocks();
});

async function mount(layoutId = 'etiqueta-media-10') {
  await act(async () => {
    root.render(
      <LabelPreviewPanel product={PRODUCT} hasProducts layoutId={layoutId} onLayoutChange={() => {}} />,
    );
  });
}

function credit() {
  return container.querySelector('[data-credit-state]');
}

function field(name) {
  return credit().querySelector(`[data-credit-field="${name}"]`);
}

function button(text) {
  return [...credit().querySelectorAll('button')].find((node) => node.textContent === text);
}

function box(text) {
  return [...credit().querySelectorAll('label')]
    .find((node) => node.textContent === text)
    .querySelector('input[type="checkbox"]');
}

function radio(text) {
  return [...credit().querySelectorAll('label')]
    .find((node) => node.textContent === text)
    .querySelector('input[type="radio"]');
}

function zone(role) {
  return container.querySelector(`[data-label-zone="${role}"]`);
}

function stored() {
  return JSON.parse(window.localStorage.getItem(LABEL_SETTINGS_STORAGE_KEY));
}

async function type(input, value) {
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

async function save(rate, installments) {
  await type(field('rate'), rate);

  if (installments !== undefined) {
    await type(field('installments'), installments);
  }

  await click(button('Salvar'));
}

function card() {
  return container.querySelector('[data-card-state]');
}

function cardButton(text) {
  return [...card().querySelectorAll('button')].find((node) => node.textContent === text);
}

describe('crediario', () => {
  it('comeca vazio, com juros simples marcado, e sem crediario na etiqueta', async () => {
    await mount();

    expect(credit().dataset.creditState).toBe('editing');
    expect(button('Salvar').disabled).toBe(true);
    expect(radio('Simples').checked).toBe(true);
    expect(zone('creditInstallment')).toBeNull();
    expect(zone('creditRate')).toBeNull();
  });

  it('salva, mostra a parcela e a taxa na previa e fica guardado', async () => {
    await mount();
    await save('8', '10');

    expect(credit().dataset.creditState).toBe('saved');
    expect(credit().querySelector('[data-credit-summary]').textContent).toBe('10x · juros simples · 8% a.m.');
    // 899,90 x (1 + 0,08 x 10) / 10 = 161,982, que fica 161,98.
    expect(zone('creditInstallment').textContent).toBe('Crediário: 10x de R$ 161,98');
    expect(zone('creditRate').textContent).toBe('Taxa de Juros: 8% a.m.');
    expect(stored()).toMatchObject({ creditRateHundredths: 800, creditInterest: 'simples', creditInstallments: 10 });
  });

  it('com Nenhum, guarda so a taxa e a etiqueta leva so ela', async () => {
    await mount();
    await click(radio('Nenhum'));

    expect(field('installments')).toBeNull();

    await save('8');

    expect(credit().querySelector('[data-credit-summary]').textContent).toBe('8% a.m. · sem cálculo da parcela');
    expect(zone('creditInstallment')).toBeNull();
    expect(zone('creditRate').textContent).toBe('Taxa de Juros: 8% a.m.');
    expect(credit().textContent).not.toContain('Arredondar');
    expect(stored()).toMatchObject({ creditRateHundredths: 800, creditInterest: 'nenhum', creditInstallments: null });
  });

  it('arredonda a parcela para ,90 pela caixa', async () => {
    await mount();
    await save('8', '10');
    await click(box('Arredondar a parcela para ,90'));

    expect(zone('creditInstallment').textContent).toBe('Crediário: 10x de R$ 161,90');
    expect(stored().creditRoundToNinety).toBe(true);

    await click(box('Arredondar a parcela para ,90'));

    expect(zone('creditInstallment').textContent).toBe('Crediário: 10x de R$ 161,98');
  });

  it('altera para juros compostos e apaga', async () => {
    await mount();
    await save('8', '10');
    await click(button('Alterar'));

    expect(field('rate').value).toBe('8');
    expect(field('installments').value).toBe('10');

    await click(radio('Compostos'));
    await click(button('Salvar'));

    // 899,90 x 0,08 / (1 - 1,08^-10) = 134,11.
    expect(zone('creditInstallment').textContent).toBe('Crediário: 10x de R$ 134,11');

    await click(button('Apagar'));

    expect(credit().dataset.creditState).toBe('editing');
    expect(zone('creditInstallment')).toBeNull();
    expect(zone('creditRate')).toBeNull();
    expect(stored()).toMatchObject({ creditRateHundredths: null, creditInstallments: null });
  });

  it.each([
    ['8', '25', 'installments', INSTALLMENT_COUNT_MESSAGE],
    ['8', '1', 'installments', INSTALLMENT_COUNT_MESSAGE],
    ['8', '', 'installments', INSTALLMENT_COUNT_MESSAGE],
    ['20,5', '10', 'rate', INTEREST_RATE_RANGE_MESSAGE],
    ['8,125', '10', 'rate', INTEREST_RATE_DECIMALS_MESSAGE],
  ])('recusa a taxa %s com %s parcelas com a frase do caso e nao grava nada', async (rate, count, fieldName, message) => {
    await mount();
    await save(rate, count);

    expect(credit().dataset.creditState).toBe('editing');
    expect(credit().textContent).toContain(message);
    expect(field(fieldName).getAttribute('aria-invalid')).toBe('true');
    expect(window.localStorage.getItem(LABEL_SETTINGS_STORAGE_KEY)).toBeNull();
    expect(zone('creditRate')).toBeNull();
  });

  it('mostra a falha de gravacao e mantem o formulario aberto', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });

    await mount();
    await save('8', '10');

    expect(credit().dataset.creditState).toBe('editing');
    expect(credit().textContent).toContain(STORAGE_FULL_MESSAGE);
    expect(zone('creditRate')).toBeNull();
  });

  it('continua guardado depois de recarregar a pagina', async () => {
    await mount();
    await save('2,5', '12');
    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);

    useLabelSettingsStore.setState({ settings: { ...DEFAULT_LABEL_SETTINGS } });
    useLabelSettingsStore.getState().reload();
    await mount();

    expect(credit().dataset.creditState).toBe('saved');
    expect(credit().querySelector('[data-credit-summary]').textContent).toBe('12x · juros simples · 2,5% a.m.');
    expect(zone('creditRate').textContent).toBe('Taxa de Juros: 2,5% a.m.');
  });

  it('nao aparece na previa da etiqueta media, que nao leva crediario', async () => {
    await mount('etiqueta-media');
    await save('8', '10');

    expect(zone('creditInstallment')).toBeNull();
    expect(zone('creditRate')).toBeNull();
    expect(zone('band')).toBeNull();
  });

  it('a faixa da base sai na etiqueta de 10 com ou sem crediario', async () => {
    await mount();

    expect(zone('band').style.backgroundColor).toBe('rgb(193, 18, 31)');
  });
});

describe('cartao sem juros', () => {
  it('comeca vazio e sem cartao na etiqueta', async () => {
    await mount();

    expect(card().dataset.cardState).toBe('editing');
    expect(cardButton('Salvar').disabled).toBe(true);
    expect(zone('card')).toBeNull();
  });

  it('salva, aparece acima do crediario e fica guardado', async () => {
    await mount();
    await type(card().querySelector('[data-card-field="installments"]'), '10');
    await click(cardButton('Salvar'));
    await save('8', '10');

    expect(card().dataset.cardState).toBe('saved');
    expect(card().querySelector('[data-card-summary]').textContent).toBe('10x sem juros no cartão');
    expect(zone('card').textContent).toBe('10x sem juros no cartão');
    expect(zone('card').compareDocumentPosition(zone('creditInstallment')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(parseFloat(zone('card').style.top)).toBeLessThan(parseFloat(zone('creditInstallment').style.top));
    expect(stored()).toMatchObject({ cardInstallments: 10, showCardInstallments: true });
  });

  it('sai da etiqueta pela caixa sem perder a quantidade, e a linha de baixo sobe', async () => {
    await mount();
    await type(card().querySelector('[data-card-field="installments"]'), '6');
    await click(cardButton('Salvar'));
    await save('8', '10');

    const cardTop = zone('card').style.top;

    await click(card().querySelector('input[type="checkbox"]'));

    expect(zone('card')).toBeNull();
    expect(zone('creditInstallment').style.top).toBe(cardTop);
    expect(stored()).toMatchObject({ cardInstallments: 6, showCardInstallments: false });
  });

  it('muda por Alterar, some por Apagar e recusa fora dos limites', async () => {
    await mount();
    await type(card().querySelector('[data-card-field="installments"]'), '25');
    await click(cardButton('Salvar'));

    expect(card().textContent).toContain(INSTALLMENT_COUNT_MESSAGE);
    expect(window.localStorage.getItem(LABEL_SETTINGS_STORAGE_KEY)).toBeNull();

    await type(card().querySelector('[data-card-field="installments"]'), '10');
    await click(cardButton('Salvar'));
    await click(cardButton('Alterar'));
    await type(card().querySelector('[data-card-field="installments"]'), '12');
    await click(cardButton('Salvar'));

    expect(zone('card').textContent).toBe('12x sem juros no cartão');

    await click(cardButton('Apagar'));

    expect(card().dataset.cardState).toBe('editing');
    expect(zone('card')).toBeNull();
    expect(stored().cardInstallments).toBeNull();
  });

  it('continua na etiqueta media, que nao leva crediario', async () => {
    await mount('etiqueta-media');
    await type(card().querySelector('[data-card-field="installments"]'), '10');
    await click(cardButton('Salvar'));

    expect(zone('card').textContent).toBe('10x sem juros no cartão');
  });
});
