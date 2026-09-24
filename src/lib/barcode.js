/**
 * Motor de geracao do simbolo 2D da etiqueta.
 *
 * O motor recebe o texto pronto e nao sabe o que ele significa: quem monta o
 * texto de um exemplar e o contrato em `symbolContent.js`. A separacao deixa o
 * motor total — qualquer texto dentro do limite vira simbolo — e mantem o
 * contrato do texto escrito num lugar so.
 *
 * A saida e uma string SVG sem unidade, com a zona de silencio ja embutida na
 * propria caixa do simbolo. Embutida, e nao deixada a cargo de quem posiciona,
 * porque invadir a zona passaria a exigir entrar dentro da caixa do simbolo, o
 * que o posicionamento nao faz. O fundo da zona e branco explicito: fundo
 * transparente deixaria a cor da etiqueta invadir a area que precisa ficar
 * limpa.
 *
 * O modulo e puro em relacao ao navegador: nao toca DOM nem canvas, e roda
 * tanto na pagina quanto na suite de testes sem ambiente grafico.
 */

import { buildSymbolText } from '../domain/services/symbolContent.js';

import { readCachedSymbol, writeCachedSymbol } from './barcodeCache.js';
import { BARCODE_ERROR_CODES, BarcodeError, toBarcodeError } from './barcodeError.js';
import { normalizeSymbolSvg, readSvgViewBox } from './barcodeSvg.js';
import {
  BARCODE_ERROR_CORRECTION_LEVEL,
  BARCODE_MODULE_UNITS,
  BARCODE_QUIET_ZONE_MODULES,
  BARCODE_SYMBOLOGY,
  SYMBOL_TEXT_SUPPORT_REASONS,
  describeSymbolTextSupport,
  needsUtf8Declaration,
} from './barcodeSymbology.js';

export {
  BARCODE_ERROR_CORRECTION_LEVEL,
  BARCODE_QUIET_ZONE_MODULES,
  BARCODE_SYMBOLOGY,
  canEncodeSymbolText,
} from './barcodeSymbology.js';

/**
 * Opcoes entregues a biblioteca. Nao ha `width`, nao ha `height` e nao ha
 * escala assimetrica: sem esses tres o simbolo nao tem como sair esticado.
 * O espacamento e contado em unidades de desenho, duas por modulo.
 */
const ENCODE_OPTIONS = Object.freeze({
  bcid: BARCODE_SYMBOLOGY,
  eclevel: BARCODE_ERROR_CORRECTION_LEVEL,
  scale: 1,
  padding: BARCODE_QUIET_ZONE_MODULES * BARCODE_MODULE_UNITS,
  backgroundcolor: 'FFFFFF',
  barcolor: '000000',
});

/**
 * Declaracao de UTF-8 no padrao da simbologia (designador 26), na sintaxe de
 * caracteres de funcao da biblioteca. Com essa leitura ligada, o circunflexo
 * do proprio texto passa a ser especial e entra dobrado.
 */
const UTF8_DECLARATION = '^ECI000026';
const CARET = /\^/g;
const CARET_ESCAPE = '^^';

const ENGINE_FAILURE_MESSAGE =
  'Não foi possível gerar o símbolo deste produto. Confira os dados do produto e tente de novo.';

let enginePromise = null;

/**
 * Carrega a biblioteca na primeira geracao, e nao na abertura da pagina. O
 * empacotador separa o modulo num arquivo proprio por causa desta importacao
 * dinamica, e e por isso que a funcao publica e assincrona.
 */
function loadEngine() {
  if (enginePromise === null) {
    enginePromise = import('./barcodeEngine.js');
  }

  return enginePromise;
}

function buildCacheKey(text) {
  return `${BARCODE_SYMBOLOGY}:${BARCODE_ERROR_CORRECTION_LEVEL}:${text}`;
}

function assertEncodable(text) {
  const support = describeSymbolTextSupport(text);

  if (support.supported) {
    return;
  }

  if (support.reason === SYMBOL_TEXT_SUPPORT_REASONS.EMPTY) {
    throw new BarcodeError(
      BARCODE_ERROR_CODES.EMPTY_CODE,
      'O conteúdo do símbolo está vazio, e sem ele não há símbolo para imprimir.',
    );
  }

  throw new BarcodeError(
    BARCODE_ERROR_CODES.CODE_TOO_LONG,
    `O conteúdo do símbolo tem ${support.byteLength} bytes e o limite é ${support.maxBytes}. ` +
      'Encurte o nome da etiqueta ou o código do sistema.',
  );
}

function engineOptions(text) {
  if (!needsUtf8Declaration(text)) {
    return { ...ENCODE_OPTIONS, text };
  }

  return {
    ...ENCODE_OPTIONS,
    text: `${UTF8_DECLARATION}${text.replace(CARET, CARET_ESCAPE)}`,
    parsefnc: true,
  };
}

/**
 * Monta o resultado publico a partir da string devolvida pela biblioteca. A
 * contagem de modulos e lida de volta do proprio desenho, e nao assumida: se a
 * biblioteca alguma vez devolver uma caixa que nao seja quadrada, a geracao
 * falha aqui em vez de imprimir um simbolo deformado.
 */
function buildSymbol(text, rawSvg) {
  const viewBox = readSvgViewBox(rawSvg);

  if (viewBox.width !== viewBox.height || viewBox.width <= 0) {
    throw new BarcodeError(BARCODE_ERROR_CODES.ENGINE_FAILURE, ENGINE_FAILURE_MESSAGE);
  }

  const totalModules = viewBox.width / BARCODE_MODULE_UNITS;
  const moduleCount = totalModules - BARCODE_QUIET_ZONE_MODULES * 2;

  if (!Number.isInteger(totalModules) || moduleCount <= 0) {
    throw new BarcodeError(BARCODE_ERROR_CODES.ENGINE_FAILURE, ENGINE_FAILURE_MESSAGE);
  }

  return Object.freeze({
    text,
    symbology: BARCODE_SYMBOLOGY,
    errorCorrectionLevel: BARCODE_ERROR_CORRECTION_LEVEL,
    moduleCount,
    quietZoneModules: BARCODE_QUIET_ZONE_MODULES,
    totalModules,
    svg: normalizeSymbolSvg(rawSvg),
  });
}

/**
 * Gera o simbolo do texto informado. O mesmo texto devolve sempre o mesmo
 * objeto enquanto o cache estiver quente.
 */
export async function generateSymbol(text) {
  assertEncodable(text);

  const cacheKey = buildCacheKey(text);
  const cached = readCachedSymbol(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const engine = await loadEngine();

  let rawSvg;

  try {
    rawSvg = engine.qrcode(engineOptions(text), engine.drawingSVG());
  } catch {
    throw new BarcodeError(BARCODE_ERROR_CODES.ENGINE_FAILURE, ENGINE_FAILURE_MESSAGE);
  }

  return writeCachedSymbol(cacheKey, buildSymbol(text, rawSvg));
}

/** Gera o simbolo de um exemplar do produto. A primeira copia e o exemplar 1. */
export async function generateProductSymbol(product, copyNumber = 1) {
  let text;

  try {
    text = buildSymbolText(product, copyNumber);
  } catch (error) {
    throw toBarcodeError(error);
  }

  return generateSymbol(text);
}
