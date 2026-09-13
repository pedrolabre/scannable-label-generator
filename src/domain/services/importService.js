import { parseCsvFile } from './csvParser.js';
import { ImportFormatError, describeImportFileError } from './importError.js';
import { IMPORT_FORMAT_CSV, IMPORT_FORMAT_JSON, IMPORT_FORMAT_XML } from './importRecord.js';
import { parseJsonText } from './jsonParser.js';
import { parseNfceDocument } from './nfceParser.js';

/**
 * Entrada do importador: recebe os arquivos escolhidos, encaminha cada um ao
 * leitor do seu formato e devolve uma lista unica de registros intermediarios
 * junto do resultado por arquivo.
 *
 * Um arquivo recusado nao interrompe o lote — a falha vira o motivo daquele
 * arquivo e a leitura segue no proximo. E os arquivos sao lidos em sequencia,
 * com uma cessao de turno entre eles, para que o progresso apareca conforme o
 * lote avanca em vez de tudo de uma vez no fim.
 */

export const ACCEPTED_FILE_EXTENSIONS = ['.csv', '.json', '.xml'];

export const IMPORT_FILE_PARSED = 'parsed';
export const IMPORT_FILE_REJECTED = 'rejected';

const FORMAT_BY_EXTENSION = {
  '.csv': IMPORT_FORMAT_CSV,
  '.json': IMPORT_FORMAT_JSON,
  '.xml': IMPORT_FORMAT_XML,
};

function detectFormat(fileName) {
  const dot = fileName.lastIndexOf('.');
  const extension = dot === -1 ? '' : fileName.slice(dot).toLowerCase();

  return FORMAT_BY_EXTENSION[extension] ?? null;
}

function yieldToInterface() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function parseSingleFile(file, fileIndex) {
  const fileName = file.name;
  const format = detectFormat(fileName);

  if (!format) {
    throw new ImportFormatError(
      `Formato não aceito. Escolha arquivos ${ACCEPTED_FILE_EXTENSIONS.join(', ')}.`,
    );
  }

  // O CSV vai inteiro para o leitor: e ele quem abre o arquivo dentro do
  // worker. Os outros dois sao lidos como texto aqui.
  if (format === IMPORT_FORMAT_CSV) {
    return parseCsvFile(file, { fileName, fileIndex });
  }

  const text = await file.text();

  if (format === IMPORT_FORMAT_JSON) {
    return parseJsonText(text, { fileName, fileIndex });
  }

  return parseNfceDocument(text, { fileName, fileIndex });
}

export async function parseImportFiles(files, { onFileSettled } = {}) {
  const selected = Array.from(files ?? []);
  const records = [];
  const results = [];

  for (const [fileIndex, file] of selected.entries()) {
    const base = { fileIndex, fileName: file.name, format: detectFormat(file.name) };
    let result;

    try {
      const parsed = await parseSingleFile(file, fileIndex);

      // Um arquivo por arquivo, e nao `push` com a lista espalhada: uma
      // planilha de centenas de milhares de linhas ultrapassa o limite de
      // argumentos de uma chamada e derrubaria o lote inteiro.
      for (const record of parsed) {
        records.push(record);
      }

      result = { ...base, status: IMPORT_FILE_PARSED, recordCount: parsed.length, error: null };
    } catch (error) {
      result = {
        ...base,
        status: IMPORT_FILE_REJECTED,
        recordCount: 0,
        error: describeImportFileError(error),
      };
    }

    results.push(result);
    onFileSettled?.(result);

    await yieldToInterface();
  }

  return { records, files: results };
}

/**
 * Contagem do lote, para o resumo que fica acima da lista de arquivos.
 */
export function summarizeImportFiles(files) {
  return files.reduce(
    (summary, file) => ({
      parsedFiles: summary.parsedFiles + (file.status === IMPORT_FILE_PARSED ? 1 : 0),
      rejectedFiles: summary.rejectedFiles + (file.status === IMPORT_FILE_REJECTED ? 1 : 0),
      recordCount: summary.recordCount + file.recordCount,
    }),
    { parsedFiles: 0, rejectedFiles: 0, recordCount: 0 },
  );
}
