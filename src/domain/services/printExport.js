/**
 * Limite, nome do arquivo e textos da exportacao.
 *
 * Funcoes puras, sem DOM e sem React. O limite fica aqui, e nao dentro do
 * componente, porque e a mesma conta que desabilita o botao e que recusa a
 * geracao: duas contas em dois lugares acabariam divergindo.
 *
 * O teto existe por causa do custo linear da geracao. Cada etiqueta tem
 * simbolo proprio, que custa alguns milissegundos para gerar e alguns
 * quilobytes de arquivo, e a selecao nao tem teto: 999 copias em algumas
 * dezenas de produtos chegam a centenas de milhares de etiquetas. O teto e alto
 * o bastante para a tiragem real de um estoque e baixo o bastante para caber
 * num arquivo que abre.
 */

import { countCopies } from './printJobBuilder.js';
import { describeProductSymbolSupport } from './symbolContent.js';

/** Teto de etiquetas por exportacao. */
export const MAX_EXPORT_LABELS = 5000;

const FILE_NAME_PREFIX = 'labelforge-etiquetas';

export function countExportLabels(items) {
  return countCopies(items);
}

export function exceedsExportLimit(items) {
  return countExportLabels(items) > MAX_EXPORT_LABELS;
}

/** Motivo escrito da recusa, ou nulo quando a tiragem cabe. */
export function describeExportLimit(items) {
  const total = countExportLabels(items);

  if (total <= MAX_EXPORT_LABELS) {
    return null;
  }

  return (
    `A seleção tem ${total} etiquetas e o limite de exportação é ${MAX_EXPORT_LABELS}. ` +
    'Reduza as cópias ou exporte em partes.'
  );
}

/** Andamento da geracao, no lugar em que o operador ja le o estado. */
export function describeExportProgress(sheetIndex, totalSheets) {
  return `Gerando folha ${sheetIndex} de ${totalSheets}…`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * Nome do arquivo baixado: produto, data local de quem exportou e modelo da
 * etiqueta. Sem identificador de trabalho, que o contrato nao tem, e sem hora,
 * que so serviria para distinguir dois arquivos iguais.
 */
export function buildExportFileName(date, labelLayoutId) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  return `${FILE_NAME_PREFIX}-${day}-${labelLayoutId}.pdf`;
}

/** Andamento da geracao dos simbolos, antes das folhas. */
export function describeSymbolProgress(done, total) {
  const format = (value) => value.toLocaleString('pt-BR');

  return `Gerando símbolos: ${format(done)} de ${format(total)}…`;
}

/**
 * Textos de simbolo da tiragem inteira, um por exemplar, na ordem em que os
 * produtos foram marcados e as copias foram numeradas. Cada copia tem texto
 * proprio, entao a tiragem de mil etiquetas pede mil simbolos. O exemplar cujo
 * texto o contrato recusa fica de fora: a etiqueta dele sai com o marcador de
 * falha.
 */
export function listExportSymbolTexts(items, products) {
  const byId = new Map(products.map((product) => [product.id, product]));
  const texts = [];

  items.forEach((item) => {
    const product = byId.get(item.productId);

    if (!product) {
      return;
    }

    for (let copy = 1; copy <= item.copies; copy += 1) {
      const content = describeProductSymbolSupport(product, copy);

      if (content.supported) {
        texts.push(content.text);
      }
    }
  });

  return texts;
}
