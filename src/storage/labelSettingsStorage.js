import {
  DEFAULT_LABEL_SETTINGS,
  LABEL_SETTINGS_FIELDS,
  LabelSettingsSchema,
} from '../domain/schemas/labelSettingsSchema.js';

/**
 * Guarda da configuracao da etiqueta no armazenamento do navegador.
 *
 * A configuracao fica fora do banco de produtos de proposito. Ela nao e
 * catalogo: zerar o catalogo ou restaurar um backup troca os produtos e deixa o
 * nome da empresa onde estava. E o banco continua na mesma versao, com o
 * arquivo de backup no mesmo formato.
 *
 * Leitura que falha — armazenamento bloqueado, valor corrompido, valor de outro
 * formato — devolve a configuracao padrao, e a tela abre sem texto nenhum em
 * vez de nao abrir. O logotipo e a parte mais sujeita a estragar, e a mais
 * pesada: quando so ele nao passa, a leitura descarta o logotipo e mantem os
 * textos. Campo que a configuracao nao tem mais — como o texto livre de
 * parcelamento, que o cartao substituiu — e deixado de fora na leitura, e o
 * resto do valor guardado continua valendo. Gravacao que falha sobe para quem chamou, que e quem diz ao operador
 * que o valor nao foi guardado; a cota cheia ganha frase propria, porque o
 * logotipo e o que a enche.
 */

export const LABEL_SETTINGS_STORAGE_KEY = 'labelforge.etiqueta';

export const STORAGE_FULL_MESSAGE =
  'Não há espaço no armazenamento deste navegador para guardar a configuração da etiqueta.';

const WITHOUT_LOGO = Object.freeze({
  logoDataUrl: DEFAULT_LABEL_SETTINGS.logoDataUrl,
  showLogo: DEFAULT_LABEL_SETTINGS.showLogo,
});

function isQuotaError(error) {
  return error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014;
}

function knownFields(saved) {
  return Object.fromEntries(
    LABEL_SETTINGS_FIELDS.filter((field) => Object.hasOwn(saved, field)).map((field) => [field, saved[field]]),
  );
}

function storage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

export function readLabelSettings() {
  try {
    const raw = storage()?.getItem(LABEL_SETTINGS_STORAGE_KEY);

    if (!raw) {
      return { ...DEFAULT_LABEL_SETTINGS };
    }

    const stored = { ...DEFAULT_LABEL_SETTINGS, ...knownFields(JSON.parse(raw)) };
    const parsed = LabelSettingsSchema.safeParse(stored);

    if (parsed.success) {
      return parsed.data;
    }

    const withoutLogo = LabelSettingsSchema.safeParse({ ...stored, ...WITHOUT_LOGO });

    return withoutLogo.success ? withoutLogo.data : { ...DEFAULT_LABEL_SETTINGS };
  } catch {
    return { ...DEFAULT_LABEL_SETTINGS };
  }
}

/** Valida e grava a configuracao inteira. Devolve o que foi gravado. */
export function writeLabelSettings(settings) {
  const validated = LabelSettingsSchema.parse(settings);
  const target = storage();

  if (!target) {
    throw new Error('O armazenamento deste navegador não está disponível.');
  }

  try {
    target.setItem(LABEL_SETTINGS_STORAGE_KEY, JSON.stringify(validated));
  } catch (error) {
    throw isQuotaError(error) ? new Error(STORAGE_FULL_MESSAGE) : error;
  }

  return validated;
}
