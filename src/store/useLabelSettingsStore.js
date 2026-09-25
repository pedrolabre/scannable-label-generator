import { useMemo } from 'react';
import { create } from 'zustand';

import { resolveLabelHeader } from '../domain/schemas/labelSettingsSchema.js';
import { readLabelSettings, writeLabelSettings } from '../storage/labelSettingsStorage.js';

/**
 * Configuracao da etiqueta em memoria, espelhando o que esta guardado no
 * dispositivo.
 *
 * O estado nasce da leitura do armazenamento, e toda alteracao grava antes de
 * mudar a memoria: se a gravacao falha, a tela continua mostrando o que esta
 * guardado de fato, e o erro sobe para quem pediu a alteracao.
 */
export const useLabelSettingsStore = create((set, get) => ({
  settings: readLabelSettings(),

  /** Rele o armazenamento. A abertura da aplicacao e o teste de remontagem usam. */
  reload: () => {
    set({ settings: readLabelSettings() });
  },

  update: (changes) => {
    const stored = writeLabelSettings({ ...get().settings, ...changes });

    set({ settings: stored });

    return stored;
  },
}));

/** Logotipo, nome da empresa, cartao e crediario como saem na etiqueta, ou nulos. */
export function useLabelHeader() {
  const settings = useLabelSettingsStore((state) => state.settings);

  return useMemo(() => resolveLabelHeader(settings), [settings]);
}
