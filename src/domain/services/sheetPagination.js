/**
 * Distribuicao das etiquetas do trabalho pelas folhas.
 *
 * Funcoes puras, sem DOM, sem React e sem armazenamento. Recebem os itens do
 * trabalho na forma do contrato (`productId` e `copies`) e a capacidade de uma
 * folha, e respondem por aritmetica: a sequencia inteira de etiquetas nunca e
 * montada. Com 999 copias por produto e selecao sem teto, uma lista com uma
 * entrada por etiqueta chegaria a centenas de milhares de objetos para desenhar
 * uma folha que mostra algumas dezenas.
 *
 * A ordem e a dos itens, que e a ordem em que o operador marcou os produtos. As
 * copias de um produto ficam juntas, e a folha e preenchida por linha, da
 * esquerda para a direita e de cima para baixo, na mesma ordem das posicoes da
 * grade.
 */

function copiesOf(item) {
  return Number.isInteger(item?.copies) && item.copies > 0 ? item.copies : 0;
}

/** Total de etiquetas e de folhas. Folha sem capacidade nao produz folha. */
export function paginateLabels(items, perSheet) {
  const totalLabels = Array.isArray(items)
    ? items.reduce((total, item) => total + copiesOf(item), 0)
    : 0;

  const totalSheets = perSheet > 0 ? Math.ceil(totalLabels / perSheet) : 0;

  return Object.freeze({ totalLabels, totalSheets });
}

/**
 * Etiquetas de uma folha, em ordem de posicao. `sheetIndex` comeca em zero.
 * `copyNumber` comeca em 1 e conta as copias do proprio produto, atravessando a
 * divisa entre folhas.
 */
export function labelsOnSheet(items, perSheet, sheetIndex) {
  if (!Array.isArray(items) || perSheet <= 0 || sheetIndex < 0) {
    return [];
  }

  const start = sheetIndex * perSheet;
  const end = start + perSheet;
  const slots = [];
  let offset = 0;

  for (const item of items) {
    const copies = copiesOf(item);
    const itemEnd = offset + copies;

    if (itemEnd > start) {
      const from = Math.max(start, offset);
      const to = Math.min(end, itemEnd);

      for (let position = from; position < to; position += 1) {
        slots.push(
          Object.freeze({
            cellIndex: position - start,
            productId: item.productId,
            copyNumber: position - offset + 1,
          }),
        );
      }
    }

    offset = itemEnd;

    if (offset >= end) {
      break;
    }
  }

  return slots;
}

/**
 * Traz a folha pedida para dentro do intervalo que existe. A selecao pode
 * encolher com o operador olhando a ultima folha; a tela mostra entao a nova
 * ultima, em vez de uma folha vazia.
 */
export function clampSheetIndex(sheetIndex, totalSheets) {
  if (totalSheets <= 0 || !Number.isInteger(sheetIndex) || sheetIndex < 0) {
    return 0;
  }

  return Math.min(sheetIndex, totalSheets - 1);
}
