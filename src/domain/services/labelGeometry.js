/**
 * Calculo das zonas fixas da etiqueta, em milimetros reais.
 *
 * Tudo aqui e funcao pura: nao toca DOM, nao renderiza, nao conhece React e
 * nao depende do conteudo do produto. As zonas saem das medidas do modelo, e
 * so delas, e e por isso que nenhum texto longo demais pode empurrar outro
 * elemento nem redimensionar a etiqueta.
 *
 *   x cresce para a direita, y cresce para baixo, origem no canto superior
 *   esquerdo da etiqueta.
 *
 * O simbolo ocupa o canto inferior direito da area util. O resto se arranja de
 * um de dois jeitos, e qual deles vale e decidido pela altura que sobra acima
 * do simbolo:
 *
 * - **Larga.** Cabecalho na largura inteira, com o codigo do sistema de um lado
 *   e o nome da empresa do outro; o nome da etiqueta logo abaixo, tambem na
 *   largura inteira; e, a esquerda do simbolo, a area comercial — "a vista", o
 *   preco, o parcelamento — com a linha fiscal rente a base.
 * - **Compacta.** Quando o simbolo toma a altura inteira, tudo vai para a
 *   coluna a esquerda dele: o codigo, a empresa embaixo do codigo, o nome, e o
 *   preco rente a base. O parcelamento e a linha fiscal ficam de fora, porque a
 *   coluna nao tem largura para eles serem lidos.
 *
 * O logotipo tem zona propria so no arranjo largo: a caixa inteira do lugar da
 * empresa no cabecalho, na altura da linha do codigo. Ele e alternativa ao nome
 * da empresa, e nao vizinho dele, entao as duas zonas ocupam o mesmo lugar e
 * so uma delas e desenhada. No arranjo compacto a linha da empresa tem menos de
 * 2 mm de altura, pouco para uma imagem, e a zona fica nula.
 *
 * As proporcoes sao constantes do modulo, e nao numeros por modelo. Um modelo
 * novo entra no catalogo declarando largura, altura, margem e lado do simbolo:
 * todo o resto e derivado, e os mesmos testes que protegem os modelos de hoje
 * passam a proteger o novo.
 */

import { MAX_SYMBOL_TOTAL_MODULES } from '../../lib/barcodeSymbology.js';
import { fitsMinimumModuleSize, moduleSizeMm } from '../../lib/barcodeSizing.js';

import { DIGIT_ADVANCE_RATIO } from './labelText.js';

export const LABEL_ARRANGEMENTS = Object.freeze({ WIDE: 'larga', COMPACT: 'compacta' });

/** Altura de linha comum a todos os textos da etiqueta. */
export const LINE_HEIGHT_RATIO = 1.15;

/** Largura do codigo do sistema dentro do cabecalho largo; o resto e da empresa. */
const HEADER_CODE_SHARE = 0.45;

const CODE_SIZE_RATIO = 0.055;
const CODE_SIZE_MIN_MM = 2.4;
const CODE_SIZE_MAX_MM = 5.2;
const COMPANY_TO_CODE = 0.62;

const NAME_SIZE_RATIO = 0.05;
const NAME_SIZE_MIN_MM = 2.2;
const NAME_SIZE_MAX_MM = 5;
const NAME_MAX_LINES = 3;

/** Piso do texto miudo: o bastante para a leitura de perto. */
const SMALL_TEXT_MIN_MM = 1.6;
const FISCAL_TEXT_MIN_MM = 1.5;
const PRICE_LABEL_TO_NAME = 0.55;
const INSTALLMENT_TO_NAME = 0.6;
const FISCAL_TO_NAME = 0.5;

/**
 * O preco e o maior texto da etiqueta. Ele nasce no dobro do nome e so encolhe
 * quando a coluna nao comporta um preco de onze caracteres, como
 * "R$ 5.569,90", nesse corpo.
 */
const PRICE_TO_NAME = 2;
const PRICE_REFERENCE_CHARS = 11;

/** Espaco entre grupos de texto, proporcional ao corpo do nome. */
const TEXT_GAP_RATIO = 0.3;
const TEXT_GAP_MIN_MM = 0.8;

/**
 * Afastamento minimo entre a caixa do simbolo e o texto mais proximo. A zona
 * de silencio ja garante o isolamento optico do simbolo por dentro da caixa;
 * este afastamento e separacao visual e folga para o desregistro da impressao.
 */
const SYMBOL_GAP_MIN_MM = 1.5;
const SYMBOL_GAP_MODULES = 2;

export class LabelGeometryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LabelGeometryError';
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function line(xMm, yMm, widthMm, fontSizeMm) {
  const lineHeightMm = fontSizeMm * LINE_HEIGHT_RATIO;

  return { xMm, yMm, widthMm, heightMm: lineHeightMm, fontSizeMm, lineHeightMm };
}

function freezeAll(zones) {
  Object.values(zones).forEach((zone) => {
    if (zone && typeof zone === 'object') {
      Object.freeze(zone);
    }
  });

  return Object.freeze(zones);
}

/** Corpos de texto do modelo, derivados da largura util. */
function typeScale(usable, columnWidthMm) {
  const codeFontSizeMm = clamp(usable.widthMm * CODE_SIZE_RATIO, CODE_SIZE_MIN_MM, CODE_SIZE_MAX_MM);
  const nameFontSizeMm = clamp(usable.widthMm * NAME_SIZE_RATIO, NAME_SIZE_MIN_MM, NAME_SIZE_MAX_MM);
  const priceFontSizeMm = Math.min(
    nameFontSizeMm * PRICE_TO_NAME,
    columnWidthMm / (PRICE_REFERENCE_CHARS * DIGIT_ADVANCE_RATIO),
  );

  return {
    code: codeFontSizeMm,
    company: Math.max(SMALL_TEXT_MIN_MM, codeFontSizeMm * COMPANY_TO_CODE),
    name: nameFontSizeMm,
    priceLabel: Math.max(SMALL_TEXT_MIN_MM, nameFontSizeMm * PRICE_LABEL_TO_NAME),
    price: priceFontSizeMm,
    installment: Math.max(SMALL_TEXT_MIN_MM, nameFontSizeMm * INSTALLMENT_TO_NAME),
    fiscal: Math.max(FISCAL_TEXT_MIN_MM, nameFontSizeMm * FISCAL_TO_NAME),
    gap: Math.max(TEXT_GAP_MIN_MM, nameFontSizeMm * TEXT_GAP_RATIO),
  };
}

function nameZone(xMm, yMm, widthMm, fontSizeMm, availableMm) {
  const lineHeightMm = fontSizeMm * LINE_HEIGHT_RATIO;
  const lines = clamp(Math.floor(availableMm / lineHeightMm), 1, NAME_MAX_LINES);

  return { xMm, yMm, widthMm, heightMm: lines * lineHeightMm, fontSizeMm, lineHeightMm, lines };
}

function wideZones({ usable, symbol, gapMm, sizes, symbolTopMm }) {
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

  const nameTopMm = header.yMm + header.heightMm + sizes.gap;
  const name = nameZone(
    usable.xMm,
    nameTopMm,
    usable.widthMm,
    sizes.name,
    symbolTopMm - gapMm - nameTopMm,
  );

  const columnTopMm = name.yMm + name.heightMm + sizes.gap;
  const column = {
    xMm: usable.xMm,
    yMm: columnTopMm,
    widthMm: usable.widthMm - symbol.sizeMm - gapMm,
    heightMm: usable.yMm + usable.heightMm - columnTopMm,
  };

  const priceLabel = line(column.xMm, column.yMm, column.widthMm, sizes.priceLabel);
  const price = line(column.xMm, priceLabel.yMm + priceLabel.heightMm, column.widthMm, sizes.price);
  const installment = line(column.xMm, price.yMm + price.heightMm, column.widthMm, sizes.installment);
  const fiscalLine = line(column.xMm, 0, column.widthMm, sizes.fiscal);
  const fiscal = { ...fiscalLine, yMm: column.yMm + column.heightMm - fiscalLine.heightMm };

  if (installment.yMm + installment.heightMm > fiscal.yMm) {
    throw new LabelGeometryError(
      'A área comercial não comporta o preço, o parcelamento e a linha fiscal neste modelo.',
    );
  }

  return { header, code, company, logo, name, column, priceLabel, price, installment, fiscal };
}

function compactZones({ usable, symbol, gapMm, sizes }) {
  const column = {
    xMm: usable.xMm,
    yMm: usable.yMm,
    widthMm: usable.widthMm - symbol.sizeMm - gapMm,
    heightMm: usable.heightMm,
  };

  const code = line(column.xMm, column.yMm, column.widthMm, sizes.code);
  const company = line(column.xMm, code.yMm + code.heightMm, column.widthMm, sizes.company);
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

  const nameTopMm = header.yMm + header.heightMm + sizes.gap;
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
    installment: null,
    fiscal: null,
  };
}

/**
 * Zonas fixas do modelo informado. Lanca quando o modelo nao comporta o
 * contrato visual: simbolo abaixo do piso de legibilidade para o maior texto
 * aceito, coluna sem largura, ou textos que nao cabem na altura.
 */
export function computeLabelGeometry(layout, totalModules = MAX_SYMBOL_TOTAL_MODULES) {
  const { widthMm, heightMm, paddingMm, symbolSizeMm } = layout;

  const usable = {
    xMm: paddingMm,
    yMm: paddingMm,
    widthMm: widthMm - paddingMm * 2,
    heightMm: heightMm - paddingMm * 2,
  };

  if (usable.widthMm <= 0 || usable.heightMm <= 0) {
    throw new LabelGeometryError('A margem interna não deixa área útil na etiqueta.');
  }

  if (symbolSizeMm > usable.widthMm || symbolSizeMm > usable.heightMm) {
    throw new LabelGeometryError('O símbolo não cabe na área útil da etiqueta.');
  }

  if (!fitsMinimumModuleSize(totalModules, symbolSizeMm)) {
    throw new LabelGeometryError(
      'O símbolo deste modelo fica abaixo do tamanho mínimo de módulo e não seria lido depois de impresso.',
    );
  }

  const symbolModuleSizeMm = moduleSizeMm(totalModules, symbolSizeMm);
  const gapMm = Math.max(SYMBOL_GAP_MIN_MM, SYMBOL_GAP_MODULES * symbolModuleSizeMm);
  const columnWidthMm = usable.widthMm - symbolSizeMm - gapMm;

  if (columnWidthMm <= 0) {
    throw new LabelGeometryError(
      'O símbolo ocupa a largura útil inteira e não sobra coluna para o preço.',
    );
  }

  const symbol = {
    xMm: usable.xMm + usable.widthMm - symbolSizeMm,
    yMm: usable.yMm + usable.heightMm - symbolSizeMm,
    sizeMm: symbolSizeMm,
    moduleSizeMm: symbolModuleSizeMm,
    totalModules,
  };

  const sizes = typeScale(usable, columnWidthMm);
  const headerMm = sizes.code * LINE_HEIGHT_RATIO;
  const nameLineMm = sizes.name * LINE_HEIGHT_RATIO;
  const fitsWide = symbol.yMm - gapMm - usable.yMm >= headerMm + sizes.gap + nameLineMm;
  const arrangement = fitsWide ? LABEL_ARRANGEMENTS.WIDE : LABEL_ARRANGEMENTS.COMPACT;

  const zones = fitsWide
    ? wideZones({ usable, symbol, gapMm, sizes, symbolTopMm: symbol.yMm })
    : compactZones({ usable, symbol, gapMm, sizes });

  return freezeAll({
    widthMm,
    heightMm,
    arrangement,
    gapMm,
    usable,
    symbol,
    ...zones,
  });
}

/**
 * Zonas de texto e o simbolo, na ordem de leitura, para quem confere
 * sobreposicao. O logotipo fica de fora porque ocupa o lugar da empresa: quem
 * confere o logotipo compara a zona dele com estas, menos a da empresa.
 */
export function listLabelZones(geometry) {
  return [
    ['code', geometry.code],
    ['company', geometry.company],
    ['name', geometry.name],
    ['priceLabel', geometry.priceLabel],
    ['price', geometry.price],
    ['installment', geometry.installment],
    ['fiscal', geometry.fiscal],
    ['symbol', geometry.symbol],
  ].filter(([, zone]) => zone !== null);
}

/** Caixa envolvente de uma zona, para a prova de que duas zonas nao se tocam. */
export function zoneBounds(zone) {
  return {
    left: zone.xMm,
    top: zone.yMm,
    right: zone.xMm + (zone.widthMm ?? zone.sizeMm),
    bottom: zone.yMm + (zone.heightMm ?? zone.sizeMm),
  };
}

/** Responde se duas zonas se sobrepoem em area, sem renderizar nada. */
export function zonesOverlap(first, second) {
  const a = zoneBounds(first);
  const b = zoneBounds(second);

  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
