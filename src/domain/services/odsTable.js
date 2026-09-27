import { ImportFormatError } from './importError.js';

/**
 * Varredura da primeira aba do `content.xml` de uma planilha OpenDocument.
 *
 * O XML e percorrido tag a tag, sem montar o documento: uma planilha de vinte
 * mil linhas tem mais de dez megabytes de XML, e a arvore inteira custaria
 * segundos e centenas de megabytes so para ler quatro colunas. A varredura
 * confere o aninhamento de cada tag e recusa o XML malformado.
 *
 * Cada linha sai com o numero dela na grade, a quantidade de vezes que se
 * repete (`table:number-rows-repeated`) e as celulas como `{ text, repeat }`,
 * com `repeat` vindo de `table:number-columns-repeated`. Nada e expandido
 * aqui: a linha vazia repetida um milhao de vezes no fim da grade sai uma vez
 * so, e quem le decide o que fazer com ela.
 *
 * O texto da celula e o dos paragrafos dela, unidos por espaco, com `text:s`
 * virando a quantidade de espacos de `text:c`, tabulacao e quebra de linha
 * virando espaco, as entidades decodificadas e as pontas aparadas. Anotacao
 * fica de fora. Sem texto nenhum, vale o valor guardado na celula.
 */

const MALFORMED_MESSAGE = 'Planilha .ods malformada: o conteúdo da planilha não pôde ser lido.';

const TABLE = 'table:table';
const ROW = 'table:table-row';
const CELLS = new Set(['table:table-cell', 'table:covered-table-cell']);
const PARAGRAPH = 'text:p';
const SPACES = 'text:s';
const SPACE_LIKE = new Set(['text:tab', 'text:line-break']);
// Conteudo que fica dentro da celula mas nao e o valor dela.
const IGNORED = new Set(['office:annotation', TABLE]);

/**
 * Um passo da varredura: comentario, instrucao, CDATA, tag de abertura ou
 * fechamento com os atributos, ou texto.
 */
const TOKEN =
  /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>|([^<]+)/y;
const FIRST_TABLE = /<table:table[\s/>]/;
const ENTITY = /&(?:#x([0-9a-fA-F]+)|#([0-9]+)|(amp|lt|gt|quot|apos));|&/g;
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const XML_SPACE = /[ \t\r\n]+/g;
const FALLBACK_VALUES = [
  'office:value',
  'office:date-value',
  'office:time-value',
  'office:boolean-value',
  'office:string-value',
];

const attributePatterns = new Map();

function attribute(attributes, name) {
  let pattern = attributePatterns.get(name);

  if (!pattern) {
    pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
    attributePatterns.set(name, pattern);
  }

  const match = pattern.exec(attributes);

  return match ? decodeEntities(match[1] ?? match[2]) : null;
}

function repetition(attributes, name) {
  const count = Number(attribute(attributes, name) ?? 1);

  return Number.isInteger(count) && count > 0 ? count : 1;
}

function decodeEntities(text) {
  if (!text.includes('&')) {
    return text;
  }

  return text.replace(ENTITY, (all, hex, decimal, named) => {
    if (named) {
      return NAMED_ENTITIES[named];
    }

    const code = hex ? parseInt(hex, 16) : Number(decimal);

    if ((hex || decimal) && code <= 0x10ffff) {
      return String.fromCodePoint(code);
    }

    throw new ImportFormatError(MALFORMED_MESSAGE);
  });
}

function cellText(cell) {
  if (cell.paragraphs.length > 0) {
    return cell.paragraphs.join(' ').trim();
  }

  for (const name of FALLBACK_VALUES) {
    const value = attribute(cell.attributes, name);

    if (value !== null) {
      return value.trim();
    }
  }

  return '';
}

/**
 * Percorre a primeira aba e entrega cada linha, com o numero dela na planilha,
 * a quantidade de vezes que se repete e as celulas como `{ text, repeat }`.
 */
export function scanFirstTable(xml, onRow) {
  const start = xml.search(FIRST_TABLE);

  if (start === -1) {
    return;
  }

  const stack = [];
  let ignoredDepth = 0;
  let row = null;
  let cell = null;
  let paragraph = null;
  let rowNumber = 1;

  TOKEN.lastIndex = start;

  while (TOKEN.lastIndex < xml.length) {
    const at = TOKEN.lastIndex;
    const token = TOKEN.exec(xml);

    if (!token || token.index !== at) {
      throw new ImportFormatError(MALFORMED_MESSAGE);
    }

    const [, cdata, closing, name, attributes, selfClosing, text] = token;
    const content = cdata ?? text;

    if (content !== undefined) {
      if (paragraph && ignoredDepth === 0) {
        paragraph.push((cdata ?? decodeEntities(text)).replace(XML_SPACE, ' '));
      } else if (text !== undefined && text.includes('&')) {
        decodeEntities(text);
      }

      continue;
    }

    if (name === undefined) {
      continue;
    }

    if (closing) {
      if (stack.pop() !== name) {
        throw new ImportFormatError(MALFORMED_MESSAGE);
      }

      if (ignoredDepth > 0) {
        if (IGNORED.has(name)) {
          ignoredDepth -= 1;
        }
      } else if (name === PARAGRAPH && paragraph) {
        cell.paragraphs.push(paragraph.join(''));
        paragraph = null;
      } else if (CELLS.has(name) && cell) {
        row.cells.push({ text: cellText(cell), repeat: cell.repeat });
        cell = null;
      } else if (name === ROW && row) {
        onRow(row, rowNumber);
        rowNumber += row.repeat;
        row = null;
      }

      if (stack.length === 0) {
        return;
      }

      continue;
    }

    const parent = stack.at(-1);
    const empty = selfClosing === '/';

    if (!empty) {
      stack.push(name);
    }

    if (ignoredDepth > 0 || (IGNORED.has(name) && stack.length > 1)) {
      if (!empty && IGNORED.has(name)) {
        ignoredDepth += 1;
      }
    } else if (name === ROW) {
      row = { repeat: repetition(attributes, 'table:number-rows-repeated'), cells: [] };

      if (empty) {
        onRow(row, rowNumber);
        rowNumber += row.repeat;
        row = null;
      }
    } else if (CELLS.has(name) && row && parent === ROW) {
      cell = {
        attributes,
        repeat: repetition(attributes, 'table:number-columns-repeated'),
        paragraphs: [],
      };

      if (empty) {
        row.cells.push({ text: cellText(cell), repeat: cell.repeat });
        cell = null;
      }
    } else if (name === PARAGRAPH && cell && CELLS.has(parent)) {
      paragraph = [];

      if (empty) {
        cell.paragraphs.push('');
        paragraph = null;
      }
    } else if (paragraph && name === SPACES) {
      paragraph.push(' '.repeat(repetition(attributes, 'text:c')));
    } else if (paragraph && SPACE_LIKE.has(name)) {
      paragraph.push(' ');
    }

    if (empty && stack.length === 0) {
      return;
    }
  }

  throw new ImportFormatError(MALFORMED_MESSAGE);
}
