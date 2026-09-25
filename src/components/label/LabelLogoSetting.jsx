import { useId, useRef, useState } from 'react';

import { LOGO_ACCEPT } from '../../domain/services/logoImage.js';
import { prepareLogo } from '../../lib/logoFile.js';
import { cx } from '../../lib/cx.js';

import Button from '../ui/Button.jsx';
import { FOCUS_OUTLINE, FOCUS_OUTLINE_COLORS } from '../ui/focusClasses.js';

/**
 * O logotipo da empresa, carregado uma vez e reaproveitado em toda etiqueta.
 *
 * Segue o desenho dos textos guardados. Sem logotipo, aparece so o botao de
 * carregar. Com logotipo, aparece a miniatura, a caixa que decide se ele sai na
 * etiqueta, e `Trocar` e `Remover`.
 *
 * O arquivo escolhido e preparado antes de ser guardado — SVG vira PNG e a
 * imagem grande e reduzida —, e so o resultado chega a quem grava. Arquivo de
 * outro tipo, que nao abre ou que nao cabe mesmo reduzido e recusado com o
 * motivo escrito embaixo dos botoes, e nada e gravado. A falha de gravacao
 * aparece no mesmo lugar.
 */

function firstMessage(error) {
  return error?.issues?.[0]?.message ?? error?.message ?? 'Não foi possível guardar o logotipo.';
}

export default function LabelLogoSetting({ value, visible, onSave, onVisibleChange }) {
  const inputId = useId();
  const checkboxId = useId();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const hasLogo = value !== '';

  function run(action) {
    try {
      action();
      setError(null);
    } catch (failure) {
      setError(firstMessage(failure));
    }
  }

  async function handleFile(event) {
    const [file] = event.target.files ?? [];

    // Limpa a escolha para que o mesmo arquivo possa ser escolhido de novo.
    event.target.value = '';

    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const dataUrl = await prepareLogo(file);

      onSave(dataUrl);
    } catch (failure) {
      setError(firstMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-2"
      data-label-logo-setting=""
      data-logo-state={hasLogo ? 'saved' : 'empty'}
      aria-busy={busy}
    >
      <label htmlFor={inputId} className="text-rotulo font-semibold text-neutro-tinta">
        Logotipo
      </label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={LOGO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={handleFile}
        data-logo-input=""
      />

      {hasLogo ? (
        <div className="flex h-14 items-center justify-center border border-neutro-borda bg-etiqueta-papel px-3 py-2">
          <img
            src={value}
            alt="Logotipo guardado"
            className="max-h-full max-w-full object-contain"
            data-logo-thumbnail=""
          />
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-neutro-tintaFraca">
        PNG, JPEG ou SVG. Sai no lugar do nome da empresa; a etiqueta pequena continua com o nome.
      </p>

      {hasLogo ? (
        <label
          htmlFor={checkboxId}
          className="flex cursor-pointer items-center gap-2 text-sm text-neutro-tintaMedia"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={visible}
            onChange={(event) => run(() => onVisibleChange(event.target.checked))}
            className={cx(
              'h-[17px] w-[17px] shrink-0 cursor-pointer rounded accent-marca-vermelho',
              FOCUS_OUTLINE,
              FOCUS_OUTLINE_COLORS.brand,
            )}
          />
          Mostrar o logotipo na etiqueta
        </label>
      ) : null}

      {busy ? (
        <p role="status" className="text-xs text-neutro-tintaMedia">
          Preparando a imagem…
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-marca-vermelhoTexto" data-logo-error="">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant={hasLogo ? 'secondary' : 'primary'}
          className="flex-1"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {hasLogo ? 'Trocar' : 'Carregar logotipo'}
        </Button>
        {hasLogo ? (
          <Button
            type="button"
            variant="danger"
            className="flex-1"
            disabled={busy}
            onClick={() => run(() => onSave(''))}
          >
            Remover
          </Button>
        ) : null}
      </div>
    </div>
  );
}
