import { ImportFormatError } from './importError.js';
import { IMPORT_FORMAT_TXT, createImportRecord, formatThousands } from './importRecord.js';
import { decodeReportBytes } from './txtEncoding.js';

/**
 * Leitura dos relatorios em texto do ERP, com colunas de largura fixa.
 *
 * Entram os bytes do arquivo, e nao o texto: a leitura como UTF-8 trocaria os
 * acentos por um caractere de substituicao antes de chegar aqui. A
 * decodificacao fica em `txtEncoding.js`.
 *
 * O relatorio se descreve sozinho em tres pontos, e o leitor so confia neles:
 *
 * - o titulo, no topo da pagina, diz o tipo, e o tipo da o nome das colunas —
 *   o saldo de estoque so nomeia duas das suas no cabecalho;
 * - a regua `+------+----...+` marca com `+` a borda de cada coluna, e o
 *   registro e cortado exatamente nessas posicoes;
 * - o rodape diz quantos registros o relatorio emitiu, e a contagem lida tem
 *   de ser a mesma, ou o arquivo esta incompleto.
 *
 * Registro e a linha que comeca com espaco e traz so digitos na coluna do
 * codigo. Todo o resto — cabecalho repetido a cada pagina, linhas em branco,
 * reguas, linha da loja, tracos entre grupos e rodape — fica de fora. A linha
 * `Grupo:` do saldo de estoque nao vira registro: ela da o grupo de todos os
 * registros abaixo dela, inclusive depois da quebra de pagina, onde nao se
 * repete.
 *
 * Os campos saem com o nome da coluna no relatorio e com o texto como veio,
 * sem conversao: o codigo mantem os zeros a esquerda e o numero mantem a
 * pontuacao brasileira. O que sai de cada campo sao os espacos das pontas e o
 * sublinhado com que o relatorio completa a largura da coluna — um campo so de
 * sublinhado e um campo vazio.
 */

const REPORT_KINDS = [
  {
    name: 'Tabela de Preço',
    title: /\*\s*Tabela de Preço\s*\*/,
    // Um nome por coluna da regua, na ordem.
    columns: ['Codigo', 'Descricao', 'Marca', 'Estoque', 'UN', 'Preço R$'],
    hasGroups: false,
  },
  {
    name: 'Saldo de Estoque por Grupo',
    title: /\*\*\s*Saldo de Estoque por Grupo\s*\*\*/,
    // As duas datas e a coluna de contagem a mao ficam de fora (null).
    columns: ['Codigo', 'Alternativo', 'Descricao', 'UN', 'Est. Loja', null, null, null],
    hasGroups: true,
  },
];

const GROUP_COLUMN = 'Grupo';

const RULER = /^\+(-+\+)+$/;
const GROUP_LINE = /^Grupo:\s*(.*)$/;
const FOOTER_COUNT = /Registros:\s*([\d.]+)/;
const ONLY_DIGITS = /^\d+$/;
const FILLER_UNDERSCORES = /_+$/;

function findKind(lines, rulerIndex) {
  const header = rulerIndex === -1 ? lines : lines.slice(0, rulerIndex);

  for (const line of header) {
    const kind = REPORT_KINDS.find((candidate) => candidate.title.test(line));

    if (kind) {
      return kind;
    }
  }

  return null;
}

function rulerColumns(ruler) {
  const edges = [];

  for (let i = 0; i < ruler.length; i += 1) {
    if (ruler[i] === '+') {
      edges.push(i);
    }
  }

  return edges;
}

function cleanField(text) {
  return text.trim().replace(FILLER_UNDERSCORES, '').trim();
}

function isRecordLine(line, codeEnd) {
  return line.charCodeAt(0) === 32 && ONLY_DIGITS.test(line.slice(1, codeEnd).trim());
}

export function parseTxtReport(bytes, { fileName, fileIndex }) {
  const text = decodeReportBytes(bytes);

  if (text.trim() === '') {
    throw new ImportFormatError('Relatório em texto vazio: o arquivo não tem conteúdo.');
  }

  const lines = text.split(/\r?\n/);
  const rulerIndex = lines.findIndex((line) => RULER.test(line.trimEnd()));
  const kind = findKind(lines, rulerIndex);

  if (!kind) {
    throw new ImportFormatError(
      'Relatório em texto não reconhecido: são aceitos a Tabela de Preço e o Saldo de Estoque por Grupo do ERP.',
    );
  }

  if (rulerIndex === -1) {
    throw new ImportFormatError(
      `Relatório fora do formato esperado (${kind.name}): a régua das colunas (+---+) não foi encontrada.`,
    );
  }

  const edges = rulerColumns(lines[rulerIndex].trimEnd());

  if (edges.length !== kind.columns.length + 1) {
    throw new ImportFormatError(
      `Relatório fora do formato esperado (${kind.name}): a régua tem ${edges.length - 1} colunas, e este relatório tem ${kind.columns.length}.`,
    );
  }

  const records = [];
  let group = '';
  let footerCount = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    if (!isRecordLine(line, edges[1])) {
      const groupMatch = kind.hasGroups ? GROUP_LINE.exec(line) : null;
      const footerMatch = FOOTER_COUNT.exec(line);

      if (groupMatch) {
        group = cleanField(groupMatch[1]);
      } else if (footerMatch) {
        footerCount = Number(footerMatch[1].replace(/\./g, ''));
      }

      continue;
    }

    const raw = {};

    for (let column = 0; column < kind.columns.length; column += 1) {
      const name = kind.columns[column];

      if (name !== null) {
        raw[name] = cleanField(line.slice(edges[column] + 1, edges[column + 1]));
      }
    }

    if (kind.hasGroups) {
      raw[GROUP_COLUMN] = group;
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
    throw new ImportFormatError(
      `Relatório sem registros (${kind.name}): nenhuma linha de produto foi encontrada.`,
    );
  }

  if (footerCount === null) {
    throw new ImportFormatError(
      `Relatório incompleto (${kind.name}): o rodapé com o total de registros não foi encontrado.`,
    );
  }

  if (footerCount !== records.length) {
    throw new ImportFormatError(
      `Relatório incompleto (${kind.name}): o rodapé informa ${formatThousands(footerCount)} registros, e foram lidos ${formatThousands(records.length)}.`,
    );
  }

  return records;
}
