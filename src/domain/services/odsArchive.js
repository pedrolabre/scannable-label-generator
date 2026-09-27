import { ImportFormatError } from './importError.js';

/**
 * Abertura do pacote de uma planilha OpenDocument (.ods).
 *
 * O arquivo `.ods` e um ZIP. Dele so interessa o `content.xml`, que traz as
 * abas, as linhas e as celulas; estilos, miniatura e configuracoes ficam de
 * fora. A descompressao usa o `DecompressionStream` do proprio navegador, e o
 * pacote e lido aqui mesmo, sem biblioteca de ZIP.
 *
 * O tamanho e a posicao de cada entrada vem do diretorio central, no fim do
 * arquivo, e nao do cabecalho de cada entrada: o LibreOffice grava as entradas
 * comprimidas com o bit 3 ligado, e nesse caso o cabecalho local traz o
 * tamanho zerado e o tamanho verdadeiro so aparece no diretorio central.
 *
 * O pacote e recusado inteiro quando nao e ZIP, quando declara outro tipo de
 * documento no `mimetype` e quando nao traz o `content.xml`.
 */

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const END_OF_CENTRAL_DIRECTORY_LENGTH = 22;
const MAX_ZIP_COMMENT_LENGTH = 0xffff;

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

const SPREADSHEET_MIMETYPES = [
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.spreadsheet-template',
];

const NOT_A_PACKAGE_MESSAGE =
  'Planilha .ods inválida: o arquivo não é um pacote OpenDocument. Salve a planilha de novo no formato .ods.';
const NOT_A_SPREADSHEET_MESSAGE =
  'Arquivo OpenDocument que não é planilha: são aceitas só planilhas .ods, como as salvas pelo LibreOffice Calc.';
const MISSING_CONTENT_MESSAGE =
  'Planilha .ods incompleta: o pacote não traz o conteúdo da planilha (content.xml).';
const DAMAGED_ENTRY_MESSAGE =
  'Planilha .ods corrompida: o conteúdo da planilha não pôde ser descompactado.';

function findEndOfCentralDirectory(view) {
  const last = view.byteLength - END_OF_CENTRAL_DIRECTORY_LENGTH;
  const first = Math.max(0, last - MAX_ZIP_COMMENT_LENGTH);

  for (let offset = last; offset >= first; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  return -1;
}

function readName(bytes, start, length) {
  return new TextDecoder('utf-8').decode(bytes.subarray(start, start + length));
}

/**
 * Entradas do pacote pelo diretorio central, com o metodo, os dois tamanhos e
 * a posicao do cabecalho local de cada uma.
 */
function readEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (
    bytes.byteLength < END_OF_CENTRAL_DIRECTORY_LENGTH ||
    view.getUint32(0, true) !== LOCAL_HEADER_SIGNATURE
  ) {
    throw new ImportFormatError(NOT_A_PACKAGE_MESSAGE);
  }

  const end = findEndOfCentralDirectory(view);

  if (end === -1) {
    throw new ImportFormatError(NOT_A_PACKAGE_MESSAGE);
  }

  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries = new Map();

  for (let i = 0; i < count; i += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== CENTRAL_HEADER_SIGNATURE) {
      throw new ImportFormatError(NOT_A_PACKAGE_MESSAGE);
    }

    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = readName(bytes, offset + 46, nameLength);

    entries.set(name, {
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      size: view.getUint32(offset + 24, true),
      localOffset: view.getUint32(offset + 42, true),
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return { view, entries };
}

/**
 * Bytes guardados da entrada, logo depois do cabecalho local. O nome e o
 * campo extra do cabecalho local podem ter outro tamanho que os do diretorio
 * central, e por isso sao lidos do proprio cabecalho.
 */
function storedBytes(bytes, view, entry) {
  const header = entry.localOffset;

  if (header + 30 > bytes.byteLength || view.getUint32(header, true) !== LOCAL_HEADER_SIGNATURE) {
    throw new ImportFormatError(DAMAGED_ENTRY_MESSAGE);
  }

  const start = header + 30 + view.getUint16(header + 26, true) + view.getUint16(header + 28, true);
  const end = start + entry.compressedSize;

  if (end > bytes.byteLength) {
    throw new ImportFormatError(DAMAGED_ENTRY_MESSAGE);
  }

  return bytes.subarray(start, end);
}

async function inflate(data) {
  const input = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const reader = input.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks = [];
  let length = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    length += value.byteLength;
  }

  const output = new Uint8Array(length);
  let position = 0;

  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.byteLength;
  }

  return output;
}

async function readEntryBytes(bytes, view, entry) {
  const data = storedBytes(bytes, view, entry);

  if (entry.method === METHOD_STORED) {
    return data;
  }

  if (entry.method !== METHOD_DEFLATE) {
    throw new ImportFormatError(DAMAGED_ENTRY_MESSAGE);
  }

  let output;

  try {
    output = await inflate(data);
  } catch {
    throw new ImportFormatError(DAMAGED_ENTRY_MESSAGE);
  }

  if (output.byteLength !== entry.size) {
    throw new ImportFormatError(DAMAGED_ENTRY_MESSAGE);
  }

  return output;
}

/**
 * Texto do `content.xml` de uma planilha `.ods`, a partir dos bytes do arquivo.
 */
export async function readOdsContent(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const { view, entries } = readEntries(bytes);
  const mimetype = entries.get('mimetype');

  if (!mimetype) {
    throw new ImportFormatError(NOT_A_SPREADSHEET_MESSAGE);
  }

  const declared = new TextDecoder('utf-8').decode(await readEntryBytes(bytes, view, mimetype)).trim();

  if (!SPREADSHEET_MIMETYPES.includes(declared)) {
    throw new ImportFormatError(NOT_A_SPREADSHEET_MESSAGE);
  }

  const content = entries.get('content.xml');

  if (!content) {
    throw new ImportFormatError(MISSING_CONTENT_MESSAGE);
  }

  return new TextDecoder('utf-8').decode(await readEntryBytes(bytes, view, content));
}
