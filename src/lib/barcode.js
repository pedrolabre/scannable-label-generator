/**
 * Motor de geracao do simbolo 2D do produto.
 *
 * O simbolo carrega o `systemCode` cru e mais nada: sem prefixo, sem endereco
 * de internet e sem qualquer outro campo do produto. Dois produtos que
 * compartilham o codigo do sistema produzem simbolos identicos byte a byte, e e
 * assim que o aplicativo que fotografa a etiqueta recupera exatamente o mesmo
 * texto que esta impresso ao lado, em algarismos legiveis.
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

import { readCachedSymbol, writeCachedSymbol } from './barcodeCache.js';
import { BARCODE_ERROR_CODES, BarcodeError } from './barcodeError.js';
import { normalizeSymbolSvg, readSvgViewBox } from './barcodeSvg.js';
import {
  BARCODE_ERROR_CORRECTION_LEVEL,
  BARCODE_MODULE_UNITS,
  BARCODE_QUIET_ZONE_MODULES,
  BARCODE_SYMBOLOGY,
  SYSTEM_CODE_SUPPORT_REASONS,
  describeSystemCodeSupport,
} from './barcodeSymbology.js';

export {
  BARCODE_ERROR_CORRECTION_LEVEL,
  BARCODE_QUIET_ZONE_MODULES,
  BARCODE_SYMBOLOGY,
  canEncodeSystemCode,
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

const ENGINE_FAILURE_MESSAGE =
  'Não foi possível gerar o símbolo deste produto. Confira o código do sistema e tente de novo.';

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

function buildCacheKey(systemCode) {
  return `${BARCODE_SYMBOLOGY}:${BARCODE_ERROR_CORRECTION_LEVEL}:${systemCode}`;
}

function assertEncodable(systemCode) {
  const support = describeSystemCodeSupport(systemCode);

  if (support.supported) {
    return;
  }

  if (support.reason === SYSTEM_CODE_SUPPORT_REASONS.EMPTY) {
    throw new BarcodeError(
      BARCODE_ERROR_CODES.EMPTY_CODE,
      'O código do sistema está vazio, e sem ele não há símbolo para imprimir.',
    );
  }

  if (support.reason === SYSTEM_CODE_SUPPORT_REASONS.UNSUPPORTED_CHARACTER) {
    throw new BarcodeError(
      BARCODE_ERROR_CODES.UNSUPPORTED_CHARACTER,
      'O código do sistema aceita apenas letras, números e hífen.',
    );
  }

  throw new BarcodeError(
    BARCODE_ERROR_CODES.CODE_TOO_LONG,
    `O código do sistema tem ${systemCode.length} caracteres e não cabe no símbolo, que comporta ${support.maxLength}.`,
  );
}

/**
 * Monta o resultado publico a partir da string devolvida pela biblioteca. A
 * contagem de modulos e lida de volta do proprio desenho, e nao assumida: se a
 * biblioteca alguma vez devolver uma caixa que nao seja quadrada, a geracao
 * falha aqui em vez de imprimir um simbolo deformado.
 */
function buildSymbol(systemCode, rawSvg) {
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
    systemCode,
    symbology: BARCODE_SYMBOLOGY,
    errorCorrectionLevel: BARCODE_ERROR_CORRECTION_LEVEL,
    moduleCount,
    quietZoneModules: BARCODE_QUIET_ZONE_MODULES,
    totalModules,
    svg: normalizeSymbolSvg(rawSvg),
  });
}

/**
 * Gera o simbolo do codigo informado. O mesmo codigo devolve sempre o mesmo
 * objeto enquanto o cache estiver quente.
 */
export async function generateSymbol(systemCode) {
  assertEncodable(systemCode);

  const cacheKey = buildCacheKey(systemCode);
  const cached = readCachedSymbol(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const engine = await loadEngine();

  let rawSvg;

  try {
    rawSvg = engine.qrcode({ ...ENCODE_OPTIONS, text: systemCode }, engine.drawingSVG());
  } catch {
    throw new BarcodeError(BARCODE_ERROR_CODES.ENGINE_FAILURE, ENGINE_FAILURE_MESSAGE);
  }

  return writeCachedSymbol(cacheKey, buildSymbol(systemCode, rawSvg));
}

/**
 * Gera o simbolo do produto. Le exclusivamente o `systemCode`: nenhum outro
 * campo do produto alcanca o simbolo.
 */
export function generateProductSymbol(product) {
  return generateSymbol(product?.systemCode);
}
