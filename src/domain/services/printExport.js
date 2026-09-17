/**
 * Limite, nome do arquivo e textos da exportacao.
 *
 * Funcoes puras, sem DOM e sem React. O limite fica aqui, e nao dentro do
 * componente, porque e a mesma conta que desabilita o botao e que recusa a
 * geracao: duas contas em dois lugares acabariam divergindo.
 *
 * O teto existe por causa do custo linear da geracao. Cada etiqueta custa
 * fracao de milissegundo e cerca de um quilobyte de arquivo, e a selecao nao
 * tem teto: 999 copias em algumas dezenas de produtos chegam a centenas de
 * milhares de etiquetas, o que produziria um arquivo de centenas de megabytes
 * depois de muitos segundos de espera. O teto e alto o bastante para a tiragem
 * real de um estoque e baixo o bastante para caber num arquivo que abre.
 */

import { countCopies } from './printJobBuilder.js';

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

/**
 * Codigos distintos da tiragem inteira, na ordem em que os produtos foram
 * marcados. E por aqui que a exportacao pede um simbolo por codigo, e nao um
 * por etiqueta: mil copias de um produto compartilham o mesmo desenho.
 */
export function listExportSystemCodes(items, products) {
  const byId = new Map(products.map((product) => [product.id, product]));
  const codes = [];
  const seen = new Set();

  items.forEach((item) => {
    const product = byId.get(item.productId);

    if (!product || seen.has(product.systemCode)) {
      return;
    }

    seen.add(product.systemCode);
    codes.push(product.systemCode);
  });

  return codes;
}
