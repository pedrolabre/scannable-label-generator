import { ImportFormatError } from './importError.js';
import { IMPORT_FORMAT_JSON, createImportRecord, toRawText } from './importRecord.js';

/**
 * Leitura de JSON com `JSON.parse`, sem biblioteca. Aceita tanto uma lista de
 * registros na raiz quanto um objeto que guarde essa lista em `produtos` ou
 * `products`, que sao as duas formas que exportadores de planilha costumam
 * gerar.
 *
 * A verificacao aqui e de forma do arquivo, nao de conteudo do registro: um
 * campo faltando ou um preco impossivel continuam entrando como registro, para
 * serem explicados um a um mais adiante.
 */

const LIST_PROPERTIES = ['produtos', 'products'];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function selectRows(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (isPlainObject(parsed)) {
    for (const property of LIST_PROPERTIES) {
      if (Array.isArray(parsed[property])) {
        return parsed[property];
      }
    }
  }

  return null;
}

function readFields(row) {
  const fields = {};

  for (const [name, value] of Object.entries(row)) {
    fields[name] = toRawText(value);
  }

  return fields;
}

export function parseJsonText(text, { fileName, fileIndex }) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportFormatError('JSON malformado: o arquivo não pôde ser lido.');
  }

  const rows = selectRows(parsed);

  if (!rows) {
    throw new ImportFormatError(
      'JSON fora do formato esperado: informe uma lista de registros, ou um objeto com a lista em "produtos" ou "products".',
    );
  }

  if (rows.length === 0) {
    throw new ImportFormatError('JSON sem registros: a lista está vazia.');
  }

  return rows.map((row, index) => {
    if (!isPlainObject(row)) {
      throw new ImportFormatError(
        `JSON fora do formato esperado: o registro ${index + 1} não é um conjunto de campos.`,
      );
    }

    return createImportRecord({
      fileName,
      fileIndex,
      format: IMPORT_FORMAT_JSON,
      index,
      raw: readFields(row),
    });
  });
}
