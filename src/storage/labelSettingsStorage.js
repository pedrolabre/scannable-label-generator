import {
  DEFAULT_LABEL_SETTINGS,
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
 * vez de nao abrir. Gravacao que falha sobe para quem chamou, que e quem diz ao
 * operador que o texto nao foi guardado.
 */

export const LABEL_SETTINGS_STORAGE_KEY = 'labelforge.etiqueta';

function storage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

export function readLabelSettings() {
  try {
    const raw = storage()?.getItem(LABEL_SETTINGS_STORAGE_KEY);

    if (!raw) {
      return { ...DEFAULT_LABEL_SETTINGS };
    }

    const parsed = LabelSettingsSchema.safeParse({ ...DEFAULT_LABEL_SETTINGS, ...JSON.parse(raw) });

    return parsed.success ? parsed.data : { ...DEFAULT_LABEL_SETTINGS };
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

  target.setItem(LABEL_SETTINGS_STORAGE_KEY, JSON.stringify(validated));

  return validated;
}
