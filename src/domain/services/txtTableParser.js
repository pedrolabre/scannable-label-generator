import { ImportFormatError } from './importError.js';
import { IMPORT_FORMAT_TXT, createImportRecord, toRawText } from './importRecord.js';
import { decodeReportBytes } from './txtEncoding.js';
import { parseTxtReport } from './txtReportParser.js';

/**
 * Leitura do `.txt` em colunas separadas por tabulacao, com a primeira linha
 * nomeando as colunas como na planilha. O `.txt` com a regua `+---+` ou sem
 * tabulacao na primeira linha vai para o leitor dos relatorios do ERP. O texto
 * e lido em UTF-8 e, quando nao e UTF-8 valido, pela leitura dos relatorios.
 */

const RULER = /^\+(-+\+)+$/;
const UNRECOGNIZED_REPORT = 'Relatório em texto não reconhecido';
const BYTE_ORDER_MARK = /^﻿/;

/** Quantos bytes do comeco bastam para decidir o tipo do arquivo. */
const SNIFF_LENGTH = 64 * 1024;

function decodeText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(BYTE_ORDER_MARK, '');
  } catch {
    return decodeReportBytes(bytes);
  }
}

export function isTabularText(text) {
  const lines = text.split(/\r?\n/);
  const first = lines.find((line) => line.trim() !== '');

  if (first === undefined || !first.includes('\t')) {
    return false;
  }

  return !lines.some((line) => RULER.test(line.trimEnd()));
}

function unquote(cell) {
  const text = cell.trim();

  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/""/g, '"');
  }

  return text;
}

function readHeaders(line) {
  const headers = [];
  const taken = new Set();

  line.split('\t').forEach((cell, column) => {
    const name = unquote(cell);

    if (name !== '' && !taken.has(name)) {
      taken.add(name);
      headers.push({ column, name });
    }
  });

  return headers;
}

export function parseTxtTable(text, { fileName, fileIndex }) {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() !== '');

  if (headerIndex === -1) {
    throw new ImportFormatError('Arquivo .txt vazio: o arquivo não tem conteúdo.');
  }

  const headers = readHeaders(lines[headerIndex]);

  if (headers.length < 2) {
    throw new ImportFormatError(
      'Arquivo .txt sem colunas: a primeira linha deve nomear as colunas, separadas por tabulação.',
    );
  }

  const records = [];

  for (let lineIndex = headerIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    if (line.replace(/\t/g, '').trim() === '') {
      continue;
    }

    const cells = line.split('\t');
    const raw = {};

    for (const { column, name } of headers) {
      raw[name] = toRawText(unquote(cells[column] ?? ''));
    }

    records.push(
      createImportRecord({
        fileName,
        fileIndex,
        format: IMPORT_FORMAT_TXT,
        index: records.length,
        lineNumber: lineIndex + 1,
        raw,
      }),
    );
  }

  if (records.length === 0) {
    throw new ImportFormatError('Arquivo .txt sem linhas de dados: o arquivo tem apenas o cabeçalho.');
  }

  return records;
}

export function parseTxtFile(bytes, origin) {
  const start = decodeText(bytes.subarray(0, SNIFF_LENGTH));

  if (!isTabularText(start)) {
    try {
      return parseTxtReport(bytes, origin);
    } catch (error) {
      if (error instanceof ImportFormatError && error.message.startsWith(UNRECOGNIZED_REPORT)) {
        throw new ImportFormatError(
          `${UNRECOGNIZED_REPORT}: são aceitos a Tabela de Preço e o Saldo de Estoque por Grupo do ERP, ou a planilha salva como texto, com as colunas separadas por tabulação.`,
        );
      }

      throw error;
    }
  }

  return parseTxtTable(decodeText(bytes), origin);
}
