import { useMemo } from 'react';

import { formatCentavosAsBRL } from '../../lib/currency.js';
import { computeLabelGeometry } from '../../domain/services/labelGeometry.js';
import { fitCodeText, fitNameLines, fitPriceText } from '../../domain/services/labelText.js';

/**
 * Desenho da etiqueta em milimetros reais.
 *
 * O componente e puro: recebe o produto, o modelo e o simbolo ja resolvido, e
 * nao gera simbolo nenhum. E isso que permite a montagem de uma folha gerar um
 * simbolo por codigo distinto e reaproveita-lo em todas as copias, em vez de
 * disparar uma geracao por etiqueta.
 *
 * As medidas saem por `style` em milimetro nativo do CSS. O milimetro do CSS e
 * definido pela propria especificacao da linguagem, e e ele que o navegador
 * mapeia para milimetro de papel na impressao; um multiplicador escrito a mao
 * seria o mesmo numero, arredondado. As classes utilitarias continuam cuidando
 * de cor, peso e traco, que nao tem medida fisica.
 *
 * A etiqueta e sempre preta sobre branco, mesmo com a aplicacao em modo
 * escuro: ela e a previsao de um objeto impresso, nao uma superficie da
 * interface, e o alto contraste e regra do contrato visual.
 */

const FAILED_SYMBOL_LABEL = 'Sem símbolo';

function toMm(value) {
  return `${value}mm`;
}

function zoneStyle(zone) {
  return {
    position: 'absolute',
    left: toMm(zone.xMm),
    top: toMm(zone.yMm),
    width: toMm(zone.widthMm ?? zone.sizeMm),
    height: toMm(zone.heightMm ?? zone.sizeMm),
  };
}

function SymbolZone({ zone, symbol, symbolError }) {
  const style = zoneStyle(zone);

  if (symbolError) {
    return (
      <div
        style={{ ...style, fontSize: toMm(Math.min(zone.sizeMm / 8, 3)) }}
        className="flex items-center justify-center border border-dashed border-etiqueta-tinta/50 text-center leading-tight"
      >
        {FAILED_SYMBOL_LABEL}
      </div>
    );
  }

  if (!symbol) {
    // Espaco reservado do tamanho exato da caixa do simbolo. As zonas saem das
    // medidas do modelo e nao do conteudo, entao nada se move quando o simbolo
    // chega: ele aparece dentro de um vao que ja tinha o tamanho certo.
    return (
      <div
        style={style}
        className="border border-dashed border-etiqueta-tinta/20 bg-etiqueta-papel"
        aria-hidden="true"
        data-symbol-state="pending"
      />
    );
  }

  return (
    <div
      style={style}
      className="bg-etiqueta-papel [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      data-symbol-state="ready"
      role="img"
      aria-label={`Código ${symbol.systemCode} em QR Code`}
      dangerouslySetInnerHTML={{ __html: symbol.svg }}
    />
  );
}

export default function LabelSurface({
  product,
  layout,
  symbol = null,
  symbolError = null,
  scaleFactor = 1,
  className,
}) {
  // O fator de ampliacao e assunto do invólucro: ele nunca entra no calculo,
  // para que a medida fisica da etiqueta continue sendo a do modelo.
  const rendered = useMemo(() => {
    let geometry;

    try {
      geometry = computeLabelGeometry(layout);
    } catch (error) {
      return { geometry: null, error };
    }

    const name = fitNameLines(product?.displayName, geometry.name);
    const price = fitPriceText(formatCentavosAsBRL(product?.priceInCentavos) ?? '', geometry.price);
    const code = fitCodeText(product?.systemCode, geometry.code);

    return { geometry, error: null, name, price, code };
  }, [layout, product]);

  if (rendered.error) {
    return (
      <p role="alert" className="text-sm text-marca-vermelhoTexto" data-label-state="rejected">
        {rendered.error.message}
      </p>
    );
  }

  const { geometry, name, price, code } = rendered;

  return (
    <div
      className={className}
      style={{
        width: toMm(geometry.widthMm * scaleFactor),
        height: toMm(geometry.heightMm * scaleFactor),
        flex: '0 0 auto',
      }}
    >
      <div
        data-label-surface=""
        data-label-width-mm={geometry.widthMm}
        data-label-height-mm={geometry.heightMm}
        style={{
          width: toMm(geometry.widthMm),
          height: toMm(geometry.heightMm),
          transform: `scale(${scaleFactor})`,
          transformOrigin: 'top left',
        }}
        // O traco da borda sai por `outline` e nao por `border`: borda entraria
        // na caixa e encolheria a etiqueta em fracao de milimetro.
        className="relative overflow-hidden bg-etiqueta-papel font-sans text-etiqueta-tinta outline outline-1 outline-neutro-bordaForte"
      >
        <div style={zoneStyle(geometry.name)} className="overflow-hidden">
          {name.lines.map((line, index) => (
            <div
              key={`${index}-${line}`}
              style={{
                fontSize: toMm(geometry.name.fontSizeMm),
                lineHeight: toMm(geometry.name.lineHeightMm),
              }}
              className="truncate font-semibold uppercase"
            >
              {line}
            </div>
          ))}
        </div>

        <div
          style={{
            ...zoneStyle(geometry.price),
            fontSize: toMm(price.fontSizeMm),
            lineHeight: toMm(geometry.price.heightMm),
          }}
          className="overflow-hidden whitespace-nowrap font-bold tabular-nums"
          data-label-zone="price"
        >
          {price.text}
        </div>

        <div
          style={{
            ...zoneStyle(geometry.code),
            fontSize: toMm(code.fontSizeMm),
            lineHeight: toMm(geometry.code.heightMm),
          }}
          className="overflow-hidden whitespace-nowrap tabular-nums"
          data-label-zone="code"
        >
          {code.text}
        </div>

        <SymbolZone zone={geometry.symbol} symbol={symbol} symbolError={symbolError} />
      </div>
    </div>
  );
}
