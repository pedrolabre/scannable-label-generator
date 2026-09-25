import LabelSurface from '../label/LabelSurface.jsx';

/**
 * Desenho de uma folha em milimetros reais, com cada etiqueta na posicao que a
 * grade calculou.
 *
 * A folha e sempre branca, mesmo com a aplicacao em modo escuro, pelo mesmo
 * motivo da etiqueta: ela e a previsao de um papel, e nao uma superficie da
 * interface. O contorno tracejado marca a area util, para que a margem digitada
 * fique visivel mesmo onde nao ha etiqueta.
 *
 * Cada etiqueta recebe o simbolo do proprio exemplar: duas copias do mesmo
 * produto sao duas etiquetas diferentes.
 *
 * O fator de tamanho segue o padrao da etiqueta: o involucro externo recebe a
 * medida ja multiplicada, e a folha por dentro continua com a medida do modelo,
 * reduzida por transformacao.
 */

function toMm(value) {
  return `${value}mm`;
}

export default function SheetCanvas({
  sheet,
  labelLayout,
  slots,
  symbols,
  header = {},
  scaleFactor = 1,
}) {
  return (
    <div
      style={{
        width: toMm(sheet.widthMm * scaleFactor),
        height: toMm(sheet.heightMm * scaleFactor),
        flex: '0 0 auto',
      }}
    >
      <div
        data-sheet-surface=""
        data-sheet-width-mm={sheet.widthMm}
        data-sheet-height-mm={sheet.heightMm}
        style={{
          width: toMm(sheet.widthMm),
          height: toMm(sheet.heightMm),
          transform: `scale(${scaleFactor})`,
          transformOrigin: 'top left',
        }}
        className="relative overflow-hidden bg-etiqueta-papel outline outline-1 outline-neutro-bordaForte"
      >
        <div
          aria-hidden="true"
          data-sheet-usable-area=""
          style={{
            position: 'absolute',
            left: toMm(sheet.marginLeftMm),
            top: toMm(sheet.marginTopMm),
            right: toMm(sheet.marginRightMm),
            bottom: toMm(sheet.marginBottomMm),
          }}
          className="border border-dashed border-neutro-bordaForte"
        />

        {slots.map(({ cell, product, copyNumber, symbolText, symbolError }) => {
          const resolved = symbolText ? symbols.get(symbolText) : { symbol: null, error: symbolError };

          return (
            <div
              key={cell.index}
              data-sheet-cell={cell.index}
              data-product-id={product.id}
              data-copy-number={copyNumber}
              style={{
                position: 'absolute',
                left: toMm(cell.xMm),
                top: toMm(cell.yMm),
                width: toMm(cell.widthMm),
                height: toMm(cell.heightMm),
              }}
            >
              <LabelSurface
                product={product}
                layout={labelLayout}
                symbol={resolved?.symbol ?? null}
                symbolError={resolved?.error ?? null}
                companyName={header.companyName ?? null}
                installmentText={header.installmentText ?? null}
                logo={header.logo ?? null}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
