import {
  COMPANY_NAME_MAX_LENGTH,
  INSTALLMENT_TEXT_MAX_LENGTH,
} from '../../domain/schemas/labelSettingsSchema.js';
import { useLabelSettingsStore } from '../../store/useLabelSettingsStore.js';

import SavedTextSetting from './SavedTextSetting.jsx';

/**
 * Os dois textos da etiqueta que nao pertencem a produto nenhum: o nome da
 * empresa, no cabecalho, e o parcelamento, na area comercial.
 *
 * Moram na coluna da previa porque e ali que o efeito aparece: salvar o nome
 * ou desmarcar a caixa redesenha a etiqueta logo acima. Ficam guardados neste
 * dispositivo e nao saem com zerar o catalogo nem com restaurar um backup.
 */
export default function LabelTextSettings() {
  const settings = useLabelSettingsStore((state) => state.settings);
  const update = useLabelSettingsStore((state) => state.update);

  return (
    <section aria-label="Textos da etiqueta" className="flex flex-col gap-4" data-label-text-settings="">
      <h3 className="font-display text-xs font-semibold uppercase tracking-[0.09em] text-neutro-tintaFraca">
        Textos da etiqueta
      </h3>

      <SavedTextSetting
        label="Nome da empresa"
        placeholder="Sai no cabeçalho de cada etiqueta"
        maxLength={COMPANY_NAME_MAX_LENGTH}
        value={settings.companyName}
        visible={settings.showCompanyName}
        visibilityLabel="Mostrar o nome da empresa na etiqueta"
        onSave={(companyName) => update({ companyName })}
        onVisibleChange={(showCompanyName) => update({ showCompanyName })}
      />

      <SavedTextSetting
        label="Parcelamento"
        placeholder="Ex.: 10x no cartão, juros de 8% a.m."
        maxLength={INSTALLMENT_TEXT_MAX_LENGTH}
        value={settings.installmentText}
        visible={settings.showInstallmentText}
        visibilityLabel="Mostrar o parcelamento na etiqueta"
        onSave={(installmentText) => update({ installmentText })}
        onVisibleChange={(showInstallmentText) => update({ showInstallmentText })}
      />
    </section>
  );
}
