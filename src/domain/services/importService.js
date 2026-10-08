import { parseCsvFile } from './csvParser.js';
import { ImportFormatError, describeImportFileError } from './importError.js';
import {
  IMPORT_FORMAT_CSV,
  IMPORT_FORMAT_JSON,
  IMPORT_FORMAT_ODS,
  IMPORT_FORMAT_TXT,
  IMPORT_FORMAT_XML,
} from './importRecord.js';
import { parseJsonText } from './jsonParser.js';
import { parseNfceDocument } from './nfceParser.js';
import { parseOdsFile } from './odsParser.js';
import { attachProductCandidate } from './productMapping.js';
import { parseTxtFile } from './txtTableParser.js';

/**
 * Entrada do importador: recebe os arquivos escolhidos, encaminha cada um ao
 * leitor do seu formato, traduz cada registro lido para os campos do produto e
 * devolve uma lista unica de registros junto do resultado por arquivo.
 *
 * Um arquivo recusado nao interrompe o lote — a falha vira o motivo daquele
 * arquivo e a leitura segue no proximo. E os arquivos sao lidos em sequencia,
 * com uma cessao de turno entre eles, para que o progresso apareca conforme o
 * lote avanca em vez de tudo de uma vez no fim.
 *
 * A traducao acontece aqui, num lugar so, logo apos a leitura: e o que permite
 * que a recusa por conteudo, mais adiante, receba todos os formatos na mesma
 * forma. Ela nunca recusa registro — um registro que nao pode ser traduzido
 * inteiro segue com os campos que deu, e o motivo do que faltou vai junto.
 *
 * Dois caminhos usam esta mesma entrada, cada um com a sua lista de extensoes:
 *
 * - a importacao de produtos, que cria produtos no catalogo, aceita planilha,
 *   lista, nota fiscal e `.txt` — o relatorio do ERP ou a planilha salva como
 *   texto, com as colunas separadas por tabulacao;
 * - a complementacao, que so preenche campos vazios do que ja esta cadastrado,
 *   aceita os mesmos e tambem a planilha OpenDocument. A planilha cadastral nao
 *   traz preco, e na importacao de produtos todos os registros dela seriam
 *   recusados.
 *
 * Extensao fora da lista do caminho e recusada como formato nao aceito, com a
 * lista daquele caminho na frase.
 */

export const ACCEPTED_FILE_EXTENSIONS = ['.csv', '.json', '.xml', '.txt'];

export const COMPLETION_FILE_EXTENSIONS = [...ACCEPTED_FILE_EXTENSIONS, '.ods'];

export const IMPORT_FILE_PARSED = 'parsed';
export const IMPORT_FILE_REJECTED = 'rejected';

const FORMAT_BY_EXTENSION = {
  '.csv': IMPORT_FORMAT_CSV,
  '.json': IMPORT_FORMAT_JSON,
  '.xml': IMPORT_FORMAT_XML,
  '.txt': IMPORT_FORMAT_TXT,
  '.ods': IMPORT_FORMAT_ODS,
};

function detectFormat(fileName, acceptedExtensions) {
  const dot = fileName.lastIndexOf('.');
  const extension = dot === -1 ? '' : fileName.slice(dot).toLowerCase();

  if (!acceptedExtensions.includes(extension)) {
    return null;
  }

  return FORMAT_BY_EXTENSION[extension] ?? null;
}

function yieldToInterface() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function readBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

async function parseSingleFile(file, fileIndex, acceptedExtensions) {
  const fileName = file.name;
  const format = detectFormat(fileName, acceptedExtensions);
  const origin = { fileName, fileIndex };

  if (!format) {
    throw new ImportFormatError(
      `Formato não aceito. Escolha arquivos ${acceptedExtensions.join(', ')}.`,
    );
  }

  // O CSV vai inteiro para o leitor: e ele quem abre o arquivo dentro do
  // worker. O `.txt` e a planilha OpenDocument sao lidos como bytes: o
  // relatorio do ERP nao esta em UTF-8, e a planilha e um pacote ZIP, e a
  // leitura como texto estragaria os dois antes de chegarem ao leitor. JSON e
  // XML sao lidos como texto aqui.
  if (format === IMPORT_FORMAT_CSV) {
    return parseCsvFile(file, origin);
  }

  if (format === IMPORT_FORMAT_TXT) {
    return parseTxtFile(await readBytes(file), origin);
  }

  if (format === IMPORT_FORMAT_ODS) {
    return parseOdsFile(await readBytes(file), origin);
  }

  const text = await file.text();

  if (format === IMPORT_FORMAT_JSON) {
    return parseJsonText(text, origin);
  }

  return parseNfceDocument(text, origin);
}

export async function parseImportFiles(
  files,
  { onFileSettled, acceptedExtensions = ACCEPTED_FILE_EXTENSIONS } = {},
) {
  const selected = Array.from(files ?? []);
  const records = [];
  const results = [];

  for (const [fileIndex, file] of selected.entries()) {
    const base = {
      fileIndex,
      fileName: file.name,
      format: detectFormat(file.name, acceptedExtensions),
    };
    let result;

    try {
      const parsed = await parseSingleFile(file, fileIndex, acceptedExtensions);

      // Um arquivo por arquivo, e nao `push` com a lista espalhada: uma
      // planilha de centenas de milhares de linhas ultrapassa o limite de
      // argumentos de uma chamada e derrubaria o lote inteiro.
      for (const record of parsed) {
        records.push(attachProductCandidate(record));
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
