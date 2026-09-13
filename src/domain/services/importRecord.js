/**
 * Formato intermediario do importador: a unica forma que CSV, JSON e XML de
 * NFC-e assumem depois do parsing, e a unica que os passos seguintes leem.
 *
 * O registro nao e um produto e nao pretende ser: `raw` guarda os campos como
 * vieram do arquivo, em texto, sem conversao e sem renomear nada. A traducao
 * para os campos do produto e a recusa por conteudo acontecem depois, sobre
 * esta mesma estrutura, de modo que a leitura do arquivo nunca descarte um
 * registro que o relatorio deveria explicar.
 *
 * `source` carrega a procedencia completa do registro, que e o que permite
 * apontar a origem exata de um erro e distinguir dois registros iguais vindos
 * de arquivos diferentes:
 *
 * - `fileName`  nome do arquivo escolhido;
 * - `fileIndex` posicao do arquivo no lote, ja que dois arquivos selecionados
 *               podem ter o mesmo nome;
 * - `format`    'csv', 'json' ou 'xml';
 * - `index`     posicao do registro dentro do arquivo, contada a partir de
 *               zero: linha de dados do CSV, posicao na lista do JSON, ordem
 *               do `<det>` na nota;
 * - `itemNumber` o `nItem` declarado pelo proprio XML, quando existir.
 *
 * `recordId` combina arquivo e posicao num identificador estavel dentro do
 * lote, usado como chave de lista e para levar a decisao do usuario de volta
 * ao registro que a originou.
 */

export const IMPORT_FORMAT_CSV = 'csv';
export const IMPORT_FORMAT_JSON = 'json';
export const IMPORT_FORMAT_XML = 'xml';

export function createImportRecord({
  fileName,
  fileIndex,
  format,
  index,
  itemNumber = null,
  raw,
}) {
  return {
    recordId: `${fileIndex}:${index}`,
    source: { fileName, fileIndex, format, index, itemNumber },
    raw,
  };
}

/**
 * Frase de origem do registro, em um lugar so. A linha do CSV conta o
 * cabecalho, entao o primeiro registro de dados e a linha 2 do arquivo — o
 * mesmo numero que o usuario ve ao abrir a planilha.
 */
export function describeImportOrigin(record) {
  const { fileName, format, index, itemNumber } = record.source;

  if (format === IMPORT_FORMAT_CSV) {
    return `${fileName}, linha ${index + 2}`;
  }

  if (format === IMPORT_FORMAT_XML) {
    return `${fileName}, item ${itemNumber ?? index + 1}`;
  }

  return `${fileName}, registro ${index + 1}`;
}

/**
 * Valor de um campo cru sempre em texto. Numero e booleano viram a propria
 * representacao textual, ausencia vira texto vazio, e estrutura aninhada e
 * serializada em vez de perdida — quem le decide depois o que fazer com ela.
 */
export function toRawText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}
