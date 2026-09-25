import {
  COMPANY_NAME_MAX_LENGTH,
  EMPTY_CARD_SETTINGS,
  EMPTY_CREDIT_SETTINGS,
} from '../../domain/schemas/labelSettingsSchema.js';
import { useLabelSettingsStore } from '../../store/useLabelSettingsStore.js';

import LabelCardSetting from './LabelCardSetting.jsx';
import LabelCreditSetting from './LabelCreditSetting.jsx';
import LabelLogoSetting from './LabelLogoSetting.jsx';
import SavedTextSetting from './SavedTextSetting.jsx';

/**
 * O que a etiqueta leva e nao pertence a produto nenhum: o logotipo e o nome
 * da empresa, no cabecalho; e o cartao sem juros e o crediario, na area
 * comercial, na mesma ordem em que saem na etiqueta.
 *
 * Moram na coluna da previa porque e ali que o efeito aparece: salvar o nome,
 * carregar o logotipo, guardar o cartao ou o crediario, ou desmarcar a caixa
 * redesenha a etiqueta logo acima.
 * Ficam guardados neste dispositivo e nao saem com zerar o catalogo nem com
 * restaurar um backup.
 */
export default function LabelTextSettings() {
  const settings = useLabelSettingsStore((state) => state.settings);
  const update = useLabelSettingsStore((state) => state.update);

  return (
    <section
      aria-label="Logotipo e textos da etiqueta"
      className="flex flex-col gap-4"
      data-label-text-settings=""
    >
      <h3 className="font-display text-xs font-semibold uppercase tracking-[0.09em] text-neutro-tintaFraca">
        Logotipo e textos da etiqueta
      </h3>

      <LabelLogoSetting
        value={settings.logoDataUrl}
        visible={settings.showLogo}
        onSave={(logoDataUrl) => update({ logoDataUrl })}
        onVisibleChange={(showLogo) => update({ showLogo })}
      />

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

      <LabelCardSetting
        settings={settings}
        onSave={(cardInstallments) =>
          update(cardInstallments === null ? EMPTY_CARD_SETTINGS : { cardInstallments })
        }
        onChange={update}
      />

      <LabelCreditSetting
        settings={settings}
        onSave={(credit) => update(credit ?? EMPTY_CREDIT_SETTINGS)}
        onChange={update}
      />
    </section>
  );
}
