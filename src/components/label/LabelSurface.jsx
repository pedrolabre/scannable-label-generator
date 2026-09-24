import { useMemo } from 'react';

import { cx } from '../../lib/cx.js';
import { describeLabelContent } from '../../domain/services/labelContent.js';
import { computeLabelGeometry } from '../../domain/services/labelGeometry.js';

/**
 * Desenho da etiqueta em milimetros reais.
 *
 * O componente e puro: recebe o produto, o modelo e o simbolo do exemplar ja
 * resolvido, e nao gera simbolo nenhum. Quem gera e quem sabe qual exemplar a
 * etiqueta e — a previa individual mostra o primeiro, a folha mostra cada um.
 *
 * O que vai escrito e onde sai de `describeLabelContent`, a mesma lista que o
 * arquivo impresso desenha. Aqui ela so vira elemento posicionado.
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
      aria-label={`QR Code com o conteúdo ${symbol.text}`}
      data-symbol-text={symbol.text}
      dangerouslySetInnerHTML={{ __html: symbol.svg }}
    />
  );
}

function TextLine({ item }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: toMm(item.xMm),
        top: toMm(item.yMm),
        width: toMm(item.widthMm),
        height: toMm(item.lineHeightMm),
        fontSize: toMm(item.fontSizeMm),
        lineHeight: toMm(item.lineHeightMm),
      }}
      className={cx(
        'overflow-hidden text-ellipsis whitespace-nowrap',
        item.bold ? 'font-bold' : 'font-normal',
        item.face === 'display' ? 'font-display' : 'font-sans',
        item.digits && 'tabular-nums',
        item.uppercase && 'uppercase',
        item.align === 'right' ? 'text-right' : 'text-left',
      )}
      data-label-zone={item.role}
    >
      {item.text}
    </div>
  );
}

export default function LabelSurface({
  product,
  layout,
  symbol = null,
  symbolError = null,
  companyName = null,
  installmentText = null,
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

    const content = describeLabelContent({ product, geometry, companyName, installmentText });

    return { geometry, error: null, content };
  }, [layout, product, companyName, installmentText]);

  if (rendered.error) {
    return (
      <p role="alert" className="text-sm text-marca-vermelhoTexto" data-label-state="rejected">
        {rendered.error.message}
      </p>
    );
  }

  const { geometry, content } = rendered;

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
        data-label-arrangement={geometry.arrangement}
        style={{
          width: toMm(geometry.widthMm),
          height: toMm(geometry.heightMm),
          transform: `scale(${scaleFactor})`,
          transformOrigin: 'top left',
        }}
        // O traco da borda sai por `outline` e nao por `border`: borda entraria
        // na caixa e encolheria a etiqueta em fracao de milimetro.
        className="relative overflow-hidden bg-etiqueta-papel text-etiqueta-tinta outline outline-1 outline-neutro-bordaForte"
      >
        {content.map((item) => (
          <TextLine key={`${item.role}-${item.yMm}`} item={item} />
        ))}

        <SymbolZone zone={geometry.symbol} symbol={symbol} symbolError={symbolError} />
      </div>
    </div>
  );
}
