import { readOdsContent } from './odsArchive.js';
import { hasCp850Misreading, repairCp850Misreading } from './odsEncoding.js';
import { scanFirstTable } from './odsTable.js';
import { ImportFormatError } from './importError.js';
import { IMPORT_FORMAT_ODS, createImportRecord } from './importRecord.js';

/**
 * Leitura de planilhas OpenDocument (.ods).
 *
 * Entram os bytes do arquivo, e nao o texto: o `.ods` e um pacote ZIP, aberto
 * em `odsArchive.js`. Do `content.xml` so a primeira aba e lida, pela
 * varredura de `odsTable.js`.
 *
 * A primeira linha preenchida e o cabecalho, com as mesmas regras do CSV: nome
 * aparado, coluna sem nome fora, nome repetido fica com o primeiro. Cada linha
 * preenchida abaixo dele vira um registro, com os campos no nome da coluna.
 *
 * Duas repeticoes do formato pedem cuidado:
 *
 * - `table:number-columns-repeated` junta celulas iguais vizinhas; a celula
 *   conta pela quantidade de colunas que cobre, e as colunas seguintes nao se
 *   deslocam;
 * - `table:number-rows-repeated` junta linhas iguais vizinhas. A planilha
 *   costuma terminar com uma linha vazia repetida mais de um milhao de vezes,
 *   ate o fim da grade. Linha vazia, repetida ou nao, nao vira registro e nao
 *   e expandida; so conta na numeracao das linhas seguintes. Linha preenchida
 *   repetida vira um registro por copia.
 *
 * O valor da celula e o texto que a planilha exibe, o mesmo que sairia num CSV
 * exportado dela: `1.299,90`, e nao o `1299.9` guardado em `office:value`.
 *
 * Texto lido na pagina de codigo errada antes de chegar a planilha e
 * consertado no arquivo inteiro, pelas regras de `odsEncoding.js`. O
 * cabecalho fica como veio.
 */

const EMPTY_MESSAGE = 'Planilha .ods vazia: a primeira aba não tem nenhuma linha preenchida.';
const HEADER_ONLY_MESSAGE =
  'Planilha .ods sem linhas de dados: a primeira aba tem apenas o cabeçalho.';

function hasContent(row) {
  return row.cells.some((cell) => cell.text !== '');
}

/**
 * Colunas nomeadas do cabecalho, com a posicao de cada uma. Uma celula de
 * cabecalho repetida em varias colunas nomeia so a primeira: as outras teriam
 * o mesmo nome, e nome repetido fica com o primeiro.
 */
function readHeader(row) {
  const header = [];
  const taken = new Set();
  let column = 0;

  for (const cell of row.cells) {
    if (cell.text !== '' && !taken.has(cell.text)) {
      taken.add(cell.text);
      header.push({ column, name: cell.text });
    }

    column += cell.repeat;
  }

  return header;
}

function readValues(row, header) {
  const values = header.map(() => '');
  let column = 0;
  let next = 0;

  for (const cell of row.cells) {
    const end = column + cell.repeat;

    while (next < header.length && header[next].column < end) {
      values[next] = cell.text;
      next += 1;
    }

    if (next === header.length) {
      break;
    }

    column = end;
  }

  return values;
}

export async function parseOdsFile(bytes, { fileName, fileIndex }) {
  const xml = await readOdsContent(bytes);
  let header = null;
  const rows = [];
  let misread = false;

  scanFirstTable(xml, (row, rowNumber) => {
    if (!hasContent(row)) {
      return;
    }

    let firstLine = rowNumber;
    let repeat = row.repeat;

    if (header === null) {
      header = readHeader(row);
      firstLine += 1;
      repeat -= 1;
    }

    const values = readValues(row, header);

    if (repeat === 0 || values.every((value) => value === '')) {
      return;
    }

    misread ||= values.some(hasCp850Misreading);

    for (let copy = 0; copy < repeat; copy += 1) {
      rows.push({ lineNumber: firstLine + copy, values });
    }
  });

  if (header === null) {
    throw new ImportFormatError(EMPTY_MESSAGE);
  }

  if (rows.length === 0) {
    throw new ImportFormatError(HEADER_ONLY_MESSAGE);
  }

  return rows.map(({ lineNumber, values }, index) => {
    const raw = {};

    header.forEach(({ name }, position) => {
      raw[name] = misread ? repairCp850Misreading(values[position]) : values[position];
    });

    return createImportRecord({
      fileName,
      fileIndex,
      format: IMPORT_FORMAT_ODS,
      index,
      lineNumber,
      raw,
    });
  });
}
