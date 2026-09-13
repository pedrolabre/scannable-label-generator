import Papa from 'papaparse';

import { ImportFormatError } from './importError.js';
import { IMPORT_FORMAT_CSV, createImportRecord, toRawText } from './importRecord.js';

/**
 * Leitura de CSV com PapaParse fora da thread principal.
 *
 * `worker: true` faz a biblioteca montar o proprio worker a partir do codigo
 * dela mesma, em um blob, e ler o arquivo la dentro: uma planilha grande e
 * percorrida sem prender a interface, e nao ha entrada de worker a declarar na
 * configuracao do empacotador. Onde o navegador nao oferecer `Worker`, a
 * propria biblioteca volta para a thread principal e o resultado continua o
 * mesmo.
 *
 * A recusa aqui e sempre do arquivo inteiro e sempre por forma — cabecalho
 * ausente, separador irreconhecivel, nenhuma linha de dados. Linha com campos
 * a menos entra como registro, com os campos que faltam em branco.
 *
 * A configuracao enviada ao worker atravessa uma serializacao que nao aceita
 * funcoes: a biblioteca substitui as de `step`, `chunk`, `complete` e `error`
 * por um marcador antes de enviar, mas nenhuma outra. Por isso o espaco em
 * volta do nome da coluna e aparado aqui, na montagem do registro, e nao por
 * uma funcao de transformacao de cabecalho.
 */

const UNDETECTABLE_DELIMITER = 'UndetectableDelimiter';

function hasUndetectableDelimiter(results) {
  return (results.errors ?? []).some((error) => error.code === UNDETECTABLE_DELIMITER);
}

/**
 * Cabecalhos aproveitaveis, cada um com o nome ja aparado sob o qual sera
 * guardado. Coluna sem nome fica de fora, e dois nomes que so diferem por
 * espaco mantem o primeiro.
 */
function readHeaders(results) {
  const headers = [];
  const taken = new Set();

  for (const header of results.meta?.fields ?? []) {
    const name = header.trim();

    if (name.length > 0 && !taken.has(name)) {
      taken.add(name);
      headers.push({ key: header, name });
    }
  }

  return headers;
}

/**
 * As chaves vem do cabecalho, nao da linha: uma linha curta produz as mesmas
 * chaves das demais, com valor vazio, e o campo extra que o PapaParse guarda
 * quando a linha tem colunas a mais fica de fora.
 */
function readFields(row, headers) {
  const fields = {};

  for (const { key, name } of headers) {
    fields[name] = toRawText(row[key]);
  }

  return fields;
}

function buildRecords(results, { fileName, fileIndex }) {
  const headers = readHeaders(results);

  if (headers.length === 0) {
    throw new ImportFormatError('CSV sem cabeçalho: a primeira linha do arquivo deve nomear as colunas.');
  }

  if (headers.length < 2 && hasUndetectableDelimiter(results)) {
    throw new ImportFormatError(
      'CSV fora do formato esperado: não foi possível identificar o separador de colunas.',
    );
  }

  const rows = results.data ?? [];

  if (rows.length === 0) {
    throw new ImportFormatError('CSV sem linhas de dados: o arquivo tem apenas o cabeçalho.');
  }

  return rows.map((row, index) =>
    createImportRecord({
      fileName,
      fileIndex,
      format: IMPORT_FORMAT_CSV,
      index,
      raw: readFields(row, headers),
    }),
  );
}

export function parseCsvFile(file, { fileName, fileIndex }) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      worker: true,
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        try {
          resolve(buildRecords(results, { fileName, fileIndex }));
        } catch (error) {
          reject(error);
        }
      },
      error: () => {
        reject(new ImportFormatError('CSV malformado: o arquivo não pôde ser lido.'));
      },
    });
  });
}
