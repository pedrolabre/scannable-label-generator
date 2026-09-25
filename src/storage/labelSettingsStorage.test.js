// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_LABEL_SETTINGS,
  LabelSettingsSchema,
  resolveLabelHeader,
} from '../domain/schemas/labelSettingsSchema.js';
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

/** Valor guardado antes do logotipo existir: so os dois textos. */
const OLD_VALUE = {
  companyName: 'Loja Inventada',
  showCompanyName: false,
  installmentText: '10x no cartão',
  showInstallmentText: true,
};

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

    expect(readLabelSettings()).toEqual({ ...OLD_VALUE, logoDataUrl: '', showLogo: true });
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

    expect(readLabelSettings()).toEqual({ ...OLD_VALUE, logoDataUrl: '', showLogo: true });
  });

  it('cai no padrao quando o resto do valor tambem esta fora do contrato', () => {
    window.localStorage.setItem(
      LABEL_SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...OLD_VALUE, showLogo: 'sim' }),
    );

    expect(readLabelSettings()).toEqual({ ...OLD_VALUE, logoDataUrl: '', showLogo: true });

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
