/**
 * Regra de tamanho fisico do simbolo, em milimetros reais.
 *
 * O gerador do simbolo nao conhece milimetro: ele devolve um desenho sem
 * unidade, e quem posiciona escolhe o tamanho. Esta e a funcao que diz se o
 * tamanho escolhido ainda e legivel depois de impresso.
 *
 * O piso de 0,5 mm por modulo vem da pratica de impressao em papel comum: a
 * 300 dpi sao quase seis pontos de impressora por modulo, e a camera de celular
 * na mao precisa de mais folga do que um leitor a laser. Abaixo disso o ganho
 * de ponto da impressora come a borda do modulo e a leitura fica ao acaso.
 */

import { BARCODE_ERROR_CODES, BarcodeError } from './barcodeError.js';

export const MIN_MODULE_SIZE_MM = 0.5;
export const TARGET_MODULE_SIZE_MM = 0.6;

function assertPositive(value, description) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new BarcodeError(
      BARCODE_ERROR_CODES.INVALID_SIZE,
      `${description} precisa ser um número maior que zero.`,
    );
  }
}

/**
 * Lado de cada modulo quando o simbolo inteiro, zona de silencio incluida,
 * ocupa o lado informado.
 */
export function moduleSizeMm(totalModules, symbolSizeMm) {
  assertPositive(totalModules, 'A contagem de módulos do símbolo');
  assertPositive(symbolSizeMm, 'O lado do símbolo em milímetros');

  return symbolSizeMm / totalModules;
}

export function fitsMinimumModuleSize(totalModules, symbolSizeMm) {
  return moduleSizeMm(totalModules, symbolSizeMm) >= MIN_MODULE_SIZE_MM;
}

/**
 * Menor lado aceitavel para o simbolo inteiro, dado o numero de modulos. E o
 * numero que o catalogo de modelos de etiqueta precisa respeitar.
 */
export function minimumSymbolSizeMm(totalModules, moduleSideMm = MIN_MODULE_SIZE_MM) {
  assertPositive(totalModules, 'A contagem de módulos do símbolo');
  assertPositive(moduleSideMm, 'O lado do módulo em milímetros');

  return totalModules * moduleSideMm;
}
