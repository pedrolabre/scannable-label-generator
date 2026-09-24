/**
 * Memoria de simbolos ja gerados, por texto gravado.
 *
 * Cada exemplar tem texto proprio, mas a mesma folha e desenhada de novo a cada
 * troca de modelo, de ampliacao ou de folha, e gerar o simbolo custa alguns
 * milissegundos de thread principal. O cache vive no escopo do modulo e morre
 * com o recarregamento da pagina: nao e gravado no banco local, porque simbolo
 * e sempre reconstruivel a partir do texto e um cache persistido so criaria
 * dado velho para manter em dia.
 *
 * O teto existe para que um catalogo grande nao transforme o cache em vazamento
 * silencioso. O descarte e por ordem de entrada.
 */

export const BARCODE_CACHE_MAX_ENTRIES = 500;

const entries = new Map();

export function readCachedSymbol(key) {
  return entries.get(key);
}

export function writeCachedSymbol(key, symbol) {
  if (entries.size >= BARCODE_CACHE_MAX_ENTRIES) {
    const oldest = entries.keys().next();

    if (!oldest.done) {
      entries.delete(oldest.value);
    }
  }

  entries.set(key, symbol);

  return symbol;
}

export function clearBarcodeCache() {
  entries.clear();
}

export function barcodeCacheSize() {
  return entries.size;
}
