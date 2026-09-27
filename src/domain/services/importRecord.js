/**
 * Formato intermediario do importador: a unica forma que CSV, JSON, XML de
 * NFC-e e relatorio em texto do ERP assumem depois do parsing, e a unica que os
 * passos seguintes leem.
 *
 * O registro nao e um produto e nao pretende ser: `raw` guarda os campos como
 * vieram do arquivo, em texto, sem conversao e sem renomear nada. A traducao
 * para os campos do produto e a recusa por conteudo acontecem depois, sobre
 * esta mesma estrutura, de modo que a leitura do arquivo nunca descarte um
 * registro que o relatorio deveria explicar.
 *
 * A traducao, em `productMapping.js`, acrescenta dois campos ao registro e nao
 * altera nenhum dos que ja existem:
 *
 * - `candidate`       os campos do produto nos nomes do `ProductSchema`, so com
 *                     os que o mapeamento conseguiu produzir;
 * - `candidateIssues` o que nao coube no contrato e por que, com o texto cru do
 *                     arquivo junto.
 *
 * `raw` sobrevive a traducao de proposito, e continua vivo ate o fim do lote: o
 * motivo de uma recusa so e util ao lado do valor que a provocou. Ele vive na
 * memoria do importador e nao chega a gravacao — o produto gravado e montado a
 * partir de `candidate`, e o contrato do produto e estrito, entao uma chave
 * alheia nao atravessaria a escrita nem por engano.
 *
 * `source` carrega a procedencia completa do registro, que e o que permite
 * apontar a origem exata de um erro e distinguir dois registros iguais vindos
 * de arquivos diferentes:
 *
 * - `fileName`  nome do arquivo escolhido;
 * - `fileIndex` posicao do arquivo no lote, ja que dois arquivos selecionados
 *               podem ter o mesmo nome;
 * - `format`    'csv', 'json', 'xml' ou 'txt';
 * - `index`     posicao do registro dentro do arquivo, contada a partir de
 *               zero: linha de dados do CSV, posicao na lista do JSON, ordem
 *               do `<det>` na nota;
 * - `itemNumber` o `nItem` declarado pelo proprio XML, quando existir;
 * - `lineNumber` a linha fisica do registro no arquivo, contada a partir de
 *               um, so no relatorio em texto: entre um registro e outro ha
 *               cabecalho de pagina, e a posicao do registro nao diz a linha.
 *
 * `recordId` combina arquivo e posicao num identificador estavel dentro do
 * lote, usado como chave de lista e para levar a decisao do usuario de volta
 * ao registro que a originou.
 */

export const IMPORT_FORMAT_CSV = 'csv';
export const IMPORT_FORMAT_JSON = 'json';
export const IMPORT_FORMAT_XML = 'xml';
export const IMPORT_FORMAT_TXT = 'txt';

export function createImportRecord({
  fileName,
  fileIndex,
  format,
  index,
  itemNumber = null,
  lineNumber = null,
  raw,
}) {
  const source = { fileName, fileIndex, format, index, itemNumber };

  // A linha fisica so entra na procedencia de quem a tem, e a dos outros
  // formatos continua com as mesmas chaves.
  if (lineNumber !== null) {
    source.lineNumber = lineNumber;
  }

  return {
    recordId: `${fileIndex}:${index}`,
    source,
    raw,
  };
}

/**
 * Numero com ponto nos milhares, como o operador le no relatorio aberto.
 */
export function formatThousands(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Frase de origem do registro, em um lugar so. A linha do CSV conta o
 * cabecalho, entao o primeiro registro de dados e a linha 2 do arquivo — o
 * mesmo numero que o usuario ve ao abrir a planilha. No relatorio em texto a
 * linha e a fisica, com o cabecalho de cada pagina contado, que e a que o
 * operador acha ao abrir o relatorio.
 */
export function describeImportOrigin(record) {
  const { fileName, format, index, itemNumber, lineNumber } = record.source;

  if (format === IMPORT_FORMAT_CSV) {
    return `${fileName}, linha ${index + 2}`;
  }

  if (format === IMPORT_FORMAT_XML) {
    return `${fileName}, item ${itemNumber ?? index + 1}`;
  }

  if (format === IMPORT_FORMAT_TXT) {
    return `${fileName}, linha ${formatThousands(lineNumber ?? index + 1)}`;
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
