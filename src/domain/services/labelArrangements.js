/**
 * Os dois arranjos da etiqueta, em milimetros reais: onde cada zona fica
 * depois que o modelo ja deu a area util, a caixa do simbolo e os corpos de
 * texto.
 *
 * Funcoes puras, chamadas so por `computeLabelGeometry`. Elas nao decidem
 * corpo nem simbolo: recebem os dois prontos e so empilham as zonas.
 *
 *   x cresce para a direita, y cresce para baixo, origem no canto superior
 *   esquerdo da etiqueta.
 *
 * - **Larga.** Cabecalho na largura inteira, com o codigo do sistema de um lado
 *   e o nome da empresa (ou o logotipo) do outro; o nome da etiqueta logo
 *   abaixo, tambem na largura inteira; e, a esquerda do simbolo, a area
 *   comercial — "a vista", o preco, o cartao e o crediario — com a linha
 *   fiscal rente a base.
 * - **Compacta.** Quando o simbolo toma a altura inteira, tudo vai para a
 *   coluna a esquerda dele: o codigo, a empresa embaixo do codigo, o nome, e o
 *   preco rente a base. O cartao, o crediario e a linha fiscal ficam de fora,
 *   porque a coluna nao tem largura para eles serem lidos.
 *
 * O nome ocupa quantas linhas couberem acima do simbolo, ate tres. Quando no
 * corpo do modelo nao cabem duas, o corpo do nome desce ate caber duas, sem
 * passar do piso de leitura: um nome de uma linha so corta a maior parte das
 * descricoes do catalogo, e duas linhas menores sao lidas melhor que uma
 * cortada. Os outros corpos continuam os do modelo.
 *
 * Abaixo do preco vem a linha do cartao. Nos modelos com crediario, vem depois
 * dela a linha da parcela do crediario e a da taxa; e a margem de baixo leva a
 * faixa de cor da marca, na largura util, sem encostar na caixa do simbolo nem
 * na borda de corte.
 */

/** Altura de linha comum a todos os textos da etiqueta. */
export const LINE_HEIGHT_RATIO = 1.15;

/** Largura do codigo do sistema dentro do cabecalho largo; o resto e da empresa. */
const HEADER_CODE_SHARE = 0.45;

const NAME_MAX_LINES = 3;
const NAME_MIN_LINES_WIDE = 2;

/** Espessura da faixa de cor, em fracao da margem de baixo onde ela mora. */
const BAND_TO_MARGIN = 0.32;

export class LabelGeometryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LabelGeometryError';
  }
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function line(xMm, yMm, widthMm, fontSizeMm) {
  const lineHeightMm = fontSizeMm * LINE_HEIGHT_RATIO;

  return { xMm, yMm, widthMm, heightMm: lineHeightMm, fontSizeMm, lineHeightMm };
}

function below(zone) {
  return zone.yMm + zone.heightMm;
}

function nameZone(xMm, yMm, widthMm, fontSizeMm, availableMm) {
  const lineHeightMm = fontSizeMm * LINE_HEIGHT_RATIO;
  const lines = clamp(Math.floor(availableMm / lineHeightMm), 1, NAME_MAX_LINES);

  return { xMm, yMm, widthMm, heightMm: lines * lineHeightMm, fontSizeMm, lineHeightMm, lines };
}

/**
 * Nome do arranjo largo: no corpo do modelo, ou no maior corpo que ainda deixa
 * duas linhas acima do simbolo, sem descer do piso.
 */
function wideNameZone(xMm, yMm, widthMm, sizes, availableMm) {
  const derived = nameZone(xMm, yMm, widthMm, sizes.name, availableMm);

  if (derived.lines >= NAME_MIN_LINES_WIDE) {
    return derived;
  }

  const reducedMm = Math.floor((availableMm / (NAME_MIN_LINES_WIDE * LINE_HEIGHT_RATIO)) * 100) / 100;

  if (reducedMm < sizes.nameMin) {
    return derived;
  }

  return nameZone(xMm, yMm, widthMm, reducedMm, availableMm);
}

/** Faixa de cor centrada na margem de baixo, na largura util. */
function bandZone(usable, heightMm) {
  const marginMm = heightMm - (usable.yMm + usable.heightMm);
  const thicknessMm = marginMm * BAND_TO_MARGIN;

  return {
    xMm: usable.xMm,
    yMm: heightMm - marginMm / 2 - thicknessMm / 2,
    widthMm: usable.widthMm,
    heightMm: thicknessMm,
  };
}

export function wideZones({ usable, symbol, gapMm, sizes, heightMm, withCredit }) {
  const header = line(usable.xMm, usable.yMm, usable.widthMm, sizes.code);
  const codeWidthMm = usable.widthMm * HEADER_CODE_SHARE;
  const code = { ...header, widthMm: codeWidthMm };
  // A empresa divide a linha com o codigo, em corpo menor, centrada na mesma
  // altura: a linha do cabecalho e a do codigo, e nao a dela.
  const company = {
    xMm: usable.xMm + codeWidthMm + sizes.gap,
    yMm: header.yMm,
    widthMm: usable.widthMm - codeWidthMm - sizes.gap,
    heightMm: header.heightMm,
    fontSizeMm: sizes.company,
    lineHeightMm: header.heightMm,
  };

  const logo = {
    xMm: company.xMm,
    yMm: header.yMm,
    widthMm: company.widthMm,
    heightMm: header.heightMm,
  };

  const nameTopMm = below(header) + sizes.gap;
  const name = wideNameZone(usable.xMm, nameTopMm, usable.widthMm, sizes, symbol.yMm - gapMm - nameTopMm);

  const columnTopMm = below(name) + sizes.gap;
  const column = {
    xMm: usable.xMm,
    yMm: columnTopMm,
    widthMm: usable.widthMm - symbol.sizeMm - gapMm,
    heightMm: usable.yMm + usable.heightMm - columnTopMm,
  };

  const priceLabel = line(column.xMm, column.yMm, column.widthMm, sizes.priceLabel);
  const price = line(column.xMm, below(priceLabel), column.widthMm, sizes.price);
  const card = line(column.xMm, below(price), column.widthMm, sizes.support);
  const creditInstallment = withCredit
    ? line(column.xMm, below(card), column.widthMm, sizes.creditInstallment)
    : null;
  const creditRate = withCredit
    ? line(column.xMm, below(creditInstallment), column.widthMm, sizes.support)
    : null;
  const fiscalLine = line(column.xMm, 0, column.widthMm, sizes.fiscal);
  const fiscal = { ...fiscalLine, yMm: column.yMm + column.heightMm - fiscalLine.heightMm };

  if (below(creditRate ?? card) > fiscal.yMm) {
    throw new LabelGeometryError(
      'A área comercial não comporta o preço, o cartão, o crediário e a linha fiscal neste modelo.',
    );
  }

  return {
    header,
    code,
    company,
    logo,
    name,
    column,
    priceLabel,
    price,
    card,
    creditInstallment,
    creditRate,
    fiscal,
    band: withCredit ? bandZone(usable, heightMm) : null,
  };
}

export function compactZones({ usable, symbol, gapMm, sizes }) {
  const column = {
    xMm: usable.xMm,
    yMm: usable.yMm,
    widthMm: usable.widthMm - symbol.sizeMm - gapMm,
    heightMm: usable.heightMm,
  };

  const code = line(column.xMm, column.yMm, column.widthMm, sizes.code);
  const company = line(column.xMm, below(code), column.widthMm, sizes.company);
  const header = {
    xMm: column.xMm,
    yMm: column.yMm,
    widthMm: column.widthMm,
    heightMm: code.heightMm + company.heightMm,
  };

  const priceLine = line(column.xMm, 0, column.widthMm, sizes.price);
  const price = { ...priceLine, yMm: column.yMm + column.heightMm - priceLine.heightMm };
  const labelLine = line(column.xMm, 0, column.widthMm, sizes.priceLabel);
  const priceLabel = { ...labelLine, yMm: price.yMm - labelLine.heightMm };

  const nameTopMm = below(header) + sizes.gap;
  const available = priceLabel.yMm - sizes.gap - nameTopMm;

  if (available < sizes.name * LINE_HEIGHT_RATIO) {
    throw new LabelGeometryError(
      'A coluna ao lado do símbolo não comporta o código, o nome e o preço neste modelo.',
    );
  }

  const name = nameZone(column.xMm, nameTopMm, column.widthMm, sizes.name, available);

  return {
    header,
    code,
    company,
    logo: null,
    name,
    column,
    priceLabel,
    price,
    card: null,
    creditInstallment: null,
    creditRate: null,
    fiscal: null,
    band: null,
  };
}
