/**
 * O que vai escrito em cada zona da etiqueta.
 *
 * A previa na tela e o arquivo impresso desenham a mesma lista, que sai daqui:
 * texto, posicao, corpo, peso e alinhamento de cada linha, em milimetros da
 * etiqueta. Um segundo lugar decidindo o que entra na etiqueta seria um segundo
 * lugar para a previa deixar de prever o papel.
 *
 * O nome da empresa e o parcelamento chegam de fora, ja resolvidos: `null`
 * quando o operador nao quer a linha na etiqueta. A etiqueta sem eles continua
 * valida, e a zona fica em branco.
 *
 * O logotipo tambem chega resolvido, com formato e medida em pixels. Onde o
 * modelo tem zona para ele, a imagem toma o lugar do nome da empresa; onde nao
 * tem, o nome continua saindo.
 *
 * Funcao pura: sem DOM, sem React e sem biblioteca de PDF.
 */

import { formatCentavosAsBRL } from '../../lib/currency.js';

import { LABEL_ARRANGEMENTS } from './labelGeometry.js';
import {
  UPPERCASE_BOLD_ADVANCE_RATIO,
  fitCodeText,
  fitNameLines,
  fitPriceText,
  fitSingleLine,
} from './labelText.js';

export const PRICE_LABEL_TEXT = 'À VISTA';

const FISCAL_SEPARATOR = ' · ';

/** NCM no formato em que aparece na nota: 9403.50.00. */
export function formatNcm(ncm) {
  if (typeof ncm !== 'string' || !/^\d{8}$/.test(ncm)) {
    return '';
  }

  return `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6)}`;
}

/** EAN e NCM numa linha, sem a parte que faltar. */
export function describeFiscalLine(product) {
  const parts = [];

  if (product?.ean) {
    parts.push(`EAN ${product.ean}`);
  }

  if (product?.ncm) {
    parts.push(`NCM ${formatNcm(product.ncm)}`);
  }

  return parts.join(FISCAL_SEPARATOR);
}

function textItem(role, zone, text, { fontSizeMm = zone.fontSizeMm, ...style } = {}) {
  return Object.freeze({
    role,
    text,
    xMm: zone.xMm,
    yMm: zone.yMm,
    widthMm: zone.widthMm,
    lineHeightMm: zone.lineHeightMm,
    fontSizeMm,
    bold: false,
    align: 'left',
    face: 'text',
    ...style,
  });
}

function optionalLine(role, zone, text, style) {
  if (!zone || typeof text !== 'string' || text.trim() === '') {
    return null;
  }

  return textItem(role, zone, fitSingleLine(text, zone).text, style);
}

/**
 * Caixa em que o logotipo e desenhado, ou nula quando nao ha logotipo ou o
 * modelo nao tem zona para ele.
 *
 * A imagem entra inteira na zona sem distorcer: a escala e a menor das duas
 * que cabem. Fica encostada a direita, como o nome da empresa que ela
 * substitui, e centrada na altura da linha do cabecalho.
 */
export function describeLabelLogo({ geometry, logo = null }) {
  const zone = geometry.logo;

  if (!logo || !zone) {
    return null;
  }

  const scale = Math.min(zone.widthMm / logo.widthPx, zone.heightMm / logo.heightPx);
  const widthMm = logo.widthPx * scale;
  const heightMm = logo.heightPx * scale;

  return Object.freeze({
    role: 'logo',
    dataUrl: logo.dataUrl,
    format: logo.format,
    xMm: zone.xMm + zone.widthMm - widthMm,
    yMm: zone.yMm + (zone.heightMm - heightMm) / 2,
    widthMm,
    heightMm,
  });
}

/**
 * Linhas de texto da etiqueta, na ordem de leitura. Linha vazia fica de fora
 * da lista em vez de entrar como texto vazio.
 */
export function describeLabelContent({
  product,
  geometry,
  companyName = null,
  installmentText = null,
  logo = null,
}) {
  const items = [];
  const code = fitCodeText(product?.systemCode, geometry.code);

  items.push(
    textItem('code', geometry.code, code.text, {
      fontSizeMm: code.fontSizeMm,
      bold: true,
      face: 'display',
    }),
  );

  const logoTakesCompany = Boolean(logo && geometry.logo);
  const company = optionalLine('company', geometry.company, logoTakesCompany ? null : companyName, {
    align: geometry.arrangement === LABEL_ARRANGEMENTS.WIDE ? 'right' : 'left',
  });

  // O nome sai em caixa alta, e o corte e medido sobre ele ja em caixa alta. A
  // tela aplica a caixa alta por estilo, para que o texto continue o do
  // cadastro para quem le a pagina; o arquivo impresso escreve a caixa alta.
  const displayName = typeof product?.displayName === 'string' ? product.displayName : '';
  const name = fitNameLines(displayName, geometry.name, UPPERCASE_BOLD_ADVANCE_RATIO);

  const nameItems = name.lines.map((text, index) =>
    textItem(
      'name',
      { ...geometry.name, yMm: geometry.name.yMm + index * geometry.name.lineHeightMm },
      text,
      { bold: true, uppercase: true },
    ),
  );

  const price = fitPriceText(formatCentavosAsBRL(product?.priceInCentavos) ?? '', geometry.price);

  return Object.freeze(
    [
      ...items,
      company,
      ...nameItems,
      textItem('priceLabel', geometry.priceLabel, PRICE_LABEL_TEXT, { bold: true }),
      textItem('price', geometry.price, price.text, {
        fontSizeMm: price.fontSizeMm,
        bold: true,
        face: 'display',
        digits: true,
      }),
      optionalLine('installment', geometry.installment, installmentText),
      optionalLine('fiscal', geometry.fiscal, describeFiscalLine(product)),
    ].filter(Boolean),
  );
}
