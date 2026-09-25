// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_LABEL_SETTINGS,
  EMPTY_CARD_SETTINGS,
  EMPTY_CREDIT_SETTINGS,
  LabelSettingsSchema,
  resolveLabelHeader,
} from '../domain/schemas/labelSettingsSchema.js';
import {
  INSTALLMENT_COUNT_MESSAGE,
  INTEREST_RATE_DECIMALS_MESSAGE,
  INTEREST_RATE_RANGE_MESSAGE,
} from '../domain/services/installmentPlan.js';
import { LOGO_MESSAGES } from '../domain/services/logoImage.js';
import { JPEG_8X4_DATA_URL, pngDataUrl } from '../lib/logoFixtures.js';
import { useLabelSettingsStore } from '../store/useLabelSettingsStore.js';

import {
  LABEL_SETTINGS_STORAGE_KEY,
  STORAGE_FULL_MESSAGE,
  readLabelSettings,
  writeLabelSettings,
} from './labelSettingsStorage.js';

const LOGO = pngDataUrl(240, 60);

/**
 * Valor guardado antes do logotipo existir: o nome da empresa e o texto livre
 * de parcelamento, que a configuracao nao tem mais.
 */
const OLD_VALUE = {
  companyName: 'Loja Inventada',
  showCompanyName: false,
  installmentText: '10x no cartão',
  showInstallmentText: true,
};

/** O que continua valendo do valor antigo. */
const OLD_READ = { companyName: 'Loja Inventada', showCompanyName: false };

function stored() {
  return JSON.parse(window.localStorage.getItem(LABEL_SETTINGS_STORAGE_KEY));
}

beforeEach(() => {
  window.localStorage.clear();
  useLabelSettingsStore.setState({ settings: { ...DEFAULT_LABEL_SETTINGS } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('contrato da configuracao', () => {
  it('comeca sem logotipo e com a caixa marcada', () => {
    expect(DEFAULT_LABEL_SETTINGS.logoDataUrl).toBe('');
    expect(DEFAULT_LABEL_SETTINGS.showLogo).toBe(true);
    expect(resolveLabelHeader(DEFAULT_LABEL_SETTINGS).logo).toBeNull();
  });

  it('aceita PNG e JPEG e recusa o resto com a frase do problema', () => {
    const base = { ...DEFAULT_LABEL_SETTINGS };

    expect(LabelSettingsSchema.safeParse({ ...base, logoDataUrl: LOGO }).success).toBe(true);
    expect(LabelSettingsSchema.safeParse({ ...base, logoDataUrl: JPEG_8X4_DATA_URL }).success).toBe(true);

    const gif = LabelSettingsSchema.safeParse({ ...base, logoDataUrl: 'data:image/gif;base64,R0lG' });

    expect(gif.success).toBe(false);
    expect(gif.error.issues[0].message).toBe(LOGO_MESSAGES.storedType);
  });

  it('entrega o logotipo ao cabecalho so com a caixa marcada', () => {
    const settings = { ...DEFAULT_LABEL_SETTINGS, logoDataUrl: LOGO, companyName: 'Loja Inventada' };

    expect(resolveLabelHeader(settings).logo).toMatchObject({ dataUrl: LOGO, widthPx: 240, heightPx: 60 });
    expect(resolveLabelHeader({ ...settings, showLogo: false }).logo).toBeNull();
    // O nome continua resolvido: e ele que sai onde nao ha lugar para a imagem.
    expect(resolveLabelHeader(settings).companyName).toBe('Loja Inventada');
  });
});

describe('leitura e gravacao', () => {
  it('le o valor guardado antes do logotipo existir, sem perder os textos', () => {
    window.localStorage.setItem(LABEL_SETTINGS_STORAGE_KEY, JSON.stringify(OLD_VALUE));

    expect(readLabelSettings()).toEqual({ ...DEFAULT_LABEL_SETTINGS, ...OLD_READ });
  });

  it('grava o logotipo e o devolve igual depois de recarregar o store', () => {
    useLabelSettingsStore.getState().update({ logoDataUrl: LOGO, showLogo: false });
    useLabelSettingsStore.setState({ settings: { ...DEFAULT_LABEL_SETTINGS } });
    useLabelSettingsStore.getState().reload();

    expect(stored().logoDataUrl).toBe(LOGO);
    expect(useLabelSettingsStore.getState().settings.logoDataUrl).toBe(LOGO);
    expect(useLabelSettingsStore.getState().settings.showLogo).toBe(false);
  });

  it('descarta so o logotipo corrompido e mantem os textos guardados', () => {
    window.localStorage.setItem(
      LABEL_SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...OLD_VALUE, logoDataUrl: 'data:image/png;base64,AAAA', showLogo: true }),
    );

    expect(readLabelSettings()).toEqual({ ...DEFAULT_LABEL_SETTINGS, ...OLD_READ });
  });

  it('cai no padrao quando o resto do valor tambem esta fora do contrato', () => {
    window.localStorage.setItem(
      LABEL_SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...OLD_VALUE, showLogo: 'sim' }),
    );

    expect(readLabelSettings()).toEqual({ ...DEFAULT_LABEL_SETTINGS, ...OLD_READ });

    window.localStorage.setItem(LABEL_SETTINGS_STORAGE_KEY, JSON.stringify({ companyName: 7 }));

    expect(readLabelSettings()).toEqual(DEFAULT_LABEL_SETTINGS);
  });

  it('recusa gravar logotipo fora do contrato e nao toca no que esta guardado', () => {
    writeLabelSettings({ ...DEFAULT_LABEL_SETTINGS, companyName: 'Loja Inventada' });

    expect(() =>
      writeLabelSettings({ ...DEFAULT_LABEL_SETTINGS, logoDataUrl: 'data:image/png;base64,AAAA' }),
    ).toThrow(LOGO_MESSAGES.storedContent);
    expect(stored()).toEqual({ ...DEFAULT_LABEL_SETTINGS, companyName: 'Loja Inventada' });
  });

  it('diz com frase propria que o armazenamento esta cheio', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });

    expect(() => writeLabelSettings({ ...DEFAULT_LABEL_SETTINGS, logoDataUrl: LOGO })).toThrow(
      STORAGE_FULL_MESSAGE,
    );
  });
});

describe('cartao e crediario guardados', () => {
  const CARD = { cardInstallments: 10, showCardInstallments: false };
  const CREDIT = {
    creditRateHundredths: 800,
    creditInterest: 'simples',
    creditInstallments: 10,
    creditRoundToNinety: true,
  };

  it('comeca sem cartao e sem crediario, e o valor antigo continua lendo sem o texto livre', () => {
    expect(resolveLabelHeader(DEFAULT_LABEL_SETTINGS)).toMatchObject({ card: null, credit: null });

    window.localStorage.setItem(LABEL_SETTINGS_STORAGE_KEY, JSON.stringify({ ...OLD_VALUE, logoDataUrl: LOGO }));

    const read = readLabelSettings();

    expect(read).toEqual({ ...DEFAULT_LABEL_SETTINGS, ...OLD_READ, logoDataUrl: LOGO });
    expect(read).not.toHaveProperty('installmentText');
  });

  it('grava cartao e crediario validos e os devolve iguais depois de recarregar o store', () => {
    useLabelSettingsStore.getState().update({ ...CARD, ...CREDIT, companyName: 'Loja Inventada' });
    useLabelSettingsStore.setState({ settings: { ...DEFAULT_LABEL_SETTINGS } });
    useLabelSettingsStore.getState().reload();

    const settings = useLabelSettingsStore.getState().settings;

    expect(stored()).toMatchObject({ ...CARD, ...CREDIT });
    expect(settings).toMatchObject({ ...CARD, ...CREDIT, companyName: 'Loja Inventada' });
    expect(resolveLabelHeader(settings).card).toBeNull();
    expect(resolveLabelHeader({ ...settings, showCardInstallments: true }).card).toEqual({ installments: 10 });
    expect(resolveLabelHeader(settings).credit).toEqual({
      rateHundredths: 800,
      interest: 'simples',
      installments: 10,
      roundToNinetyCents: true,
    });
  });

  it('guarda o crediario so com a taxa quando o calculo e Nenhum', () => {
    const settings = { ...DEFAULT_LABEL_SETTINGS, creditRateHundredths: 800, creditInterest: 'nenhum' };

    expect(LabelSettingsSchema.safeParse(settings).success).toBe(true);
    expect(resolveLabelHeader(settings).credit).toMatchObject({ rateHundredths: 800, interest: 'nenhum' });
  });

  it('recusa fora dos limites com a frase do caso e nao toca no que esta guardado', () => {
    writeLabelSettings({ ...DEFAULT_LABEL_SETTINGS, ...CARD, ...CREDIT });
    useLabelSettingsStore.getState().reload();

    const refusals = [
      [{ cardInstallments: 1 }, INSTALLMENT_COUNT_MESSAGE],
      [{ cardInstallments: 25 }, INSTALLMENT_COUNT_MESSAGE],
      [{ creditInstallments: 1 }, INSTALLMENT_COUNT_MESSAGE],
      [{ creditInstallments: 2.5 }, INSTALLMENT_COUNT_MESSAGE],
      [{ creditInstallments: null }, INSTALLMENT_COUNT_MESSAGE],
      [{ creditRateHundredths: 2001 }, INTEREST_RATE_RANGE_MESSAGE],
      [{ creditRateHundredths: -1 }, INTEREST_RATE_RANGE_MESSAGE],
      [{ creditRateHundredths: 8.5 }, INTEREST_RATE_DECIMALS_MESSAGE],
    ];

    for (const [change, message] of refusals) {
      const parsed = LabelSettingsSchema.safeParse({ ...DEFAULT_LABEL_SETTINGS, ...CARD, ...CREDIT, ...change });

      expect(parsed.success).toBe(false);
      expect(parsed.error.issues[0].message).toBe(message);
      expect(() => useLabelSettingsStore.getState().update(change)).toThrow();
    }

    expect(stored()).toEqual({ ...DEFAULT_LABEL_SETTINGS, ...CARD, ...CREDIT });
    expect(LabelSettingsSchema.safeParse({ ...DEFAULT_LABEL_SETTINGS, creditInterest: 'outro' }).success).toBe(false);
  });

  it('apagar volta ao vazio e mantem o resto', () => {
    writeLabelSettings({ ...DEFAULT_LABEL_SETTINGS, ...CARD, ...CREDIT });
    writeLabelSettings({ ...stored(), ...EMPTY_CREDIT_SETTINGS });

    expect(stored()).toMatchObject({ ...CARD, creditRateHundredths: null, creditInstallments: null });
    expect(resolveLabelHeader(stored()).credit).toBeNull();

    writeLabelSettings({ ...stored(), ...EMPTY_CARD_SETTINGS });

    expect(stored().cardInstallments).toBeNull();
    expect(resolveLabelHeader({ ...stored(), showCardInstallments: true }).card).toBeNull();
  });
});
