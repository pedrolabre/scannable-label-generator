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
 * do simbolo; as zonas de cada arranjo moram em `labelArrangements.js`.
 *
 * O logotipo tem zona propria so no arranjo largo: a caixa inteira do lugar da
 * empresa no cabecalho, na altura da linha do codigo. Ele e alternativa ao nome
 * da empresa, e nao vizinho dele, entao as duas zonas ocupam o mesmo lugar e
 * so uma delas e desenhada. No arranjo compacto a linha da empresa tem menos de
 * 2 mm de altura, pouco para uma imagem, e a zona fica nula.
 *
 * O crediario — linha da parcela e linha da taxa — e a faixa de cor da base
 * existem nos modelos em que a operacao imprime o crediario: a etiqueta de 10
 * por folha e a tag grande. Nos outros essas zonas sao nulas e o resto da
 * etiqueta fica como era. A linha do cartao existe em todo arranjo largo.
 *
 * As proporcoes sao constantes do modulo, e nao numeros por modelo. Um modelo
 * novo entra no catalogo declarando largura, altura, margem e lado do simbolo:
 * todo o resto e derivado, e os mesmos testes que protegem os modelos de hoje
 * passam a proteger o novo. A unica lista por modelo e a dos que levam
 * crediario, porque ela e escolha da operacao, e nao medida.
 */

import { MAX_SYMBOL_TOTAL_MODULES } from '../../lib/barcodeSymbology.js';
import { fitsMinimumModuleSize, moduleSizeMm } from '../../lib/barcodeSizing.js';

import {
  LINE_HEIGHT_RATIO,
  LabelGeometryError,
  clamp,
  compactZones,
  wideZones,
} from './labelArrangements.js';
import { DIGIT_ADVANCE_RATIO } from './labelText.js';

export { LINE_HEIGHT_RATIO, LabelGeometryError } from './labelArrangements.js';

export const LABEL_ARRANGEMENTS = Object.freeze({ WIDE: 'larga', COMPACT: 'compacta' });

/** Modelos com crediario e faixa de cor na base. */
export const CREDIT_LAYOUT_IDS = Object.freeze(['etiqueta-media-10', 'tag-grande']);

const CODE_SIZE_RATIO = 0.055;
const CODE_SIZE_MIN_MM = 2.4;
const CODE_SIZE_MAX_MM = 5.2;
const COMPANY_TO_CODE = 0.62;

const NAME_SIZE_RATIO = 0.05;
const NAME_SIZE_MIN_MM = 2.2;
const NAME_SIZE_MAX_MM = 5;

/** Piso do texto miudo: o bastante para a leitura de perto. */
const SMALL_TEXT_MIN_MM = 1.6;
const FISCAL_TEXT_MIN_MM = 1.5;
const PRICE_LABEL_TO_NAME = 0.55;
/** Cartao e taxa do crediario: linhas de apoio, abaixo do preco. */
const SUPPORT_TO_NAME = 0.6;
const FISCAL_TO_NAME = 0.5;

/**
 * A parcela e a segunda informacao comercial da etiqueta: vem logo abaixo do
 * preco, em corpo menor que ele e maior que as linhas de apoio.
 */
const CREDIT_INSTALLMENT_TO_NAME = 0.8;

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
    nameMin: NAME_SIZE_MIN_MM,
    priceLabel: Math.max(SMALL_TEXT_MIN_MM, nameFontSizeMm * PRICE_LABEL_TO_NAME),
    price: priceFontSizeMm,
    creditInstallment: Math.max(SMALL_TEXT_MIN_MM, nameFontSizeMm * CREDIT_INSTALLMENT_TO_NAME),
    support: Math.max(SMALL_TEXT_MIN_MM, nameFontSizeMm * SUPPORT_TO_NAME),
    fiscal: Math.max(FISCAL_TEXT_MIN_MM, nameFontSizeMm * FISCAL_TO_NAME),
    gap: Math.max(TEXT_GAP_MIN_MM, nameFontSizeMm * TEXT_GAP_RATIO),
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

  const withCredit = CREDIT_LAYOUT_IDS.includes(layout.id);
  const zones = fitsWide
    ? wideZones({ usable, symbol, gapMm, sizes, heightMm, withCredit })
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
 * confere o logotipo compara a zona dele com estas, menos a da empresa. A
 * faixa da base tambem fica de fora: ela mora na margem, fora da area util, e
 * quem a confere compara a zona dela com estas e com a borda da etiqueta.
 */
export function listLabelZones(geometry) {
  return [
    ['code', geometry.code],
    ['company', geometry.company],
    ['name', geometry.name],
    ['priceLabel', geometry.priceLabel],
    ['price', geometry.price],
    ['card', geometry.card],
    ['creditInstallment', geometry.creditInstallment],
    ['creditRate', geometry.creditRate],
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
