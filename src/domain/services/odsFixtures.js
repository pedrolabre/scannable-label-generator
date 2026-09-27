/**
 * Planilhas OpenDocument montadas na hora, para os testes do leitor.
 *
 * O pacote sai como o LibreOffice o grava: `mimetype` primeiro e sem
 * compressao, as outras entradas em deflate com o bit 3 ligado, o tamanho
 * zerado no cabecalho local e escrito so no descritor depois dos dados e no
 * diretorio central. O `content.xml` segue o mesmo desenho do arquivo salvo
 * pelo Calc, com produtos inventados do ramo de moveis e eletrodomesticos.
 *
 * Usa o `CompressionStream` do Node; nenhum modulo da aplicacao importa este
 * arquivo, e o empacotador nao o alcanca.
 */

export const ODS_MIMETYPE = 'application/vnd.oasis.opendocument.spreadsheet';

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function concat(parts) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;

  for (const part of parts) {
    output.set(part, position);
    position += part.length;
  }

  return output;
}

function littleEndian(values) {
  const bytes = new Uint8Array(values.reduce((total, [, size]) => total + size, 0));
  const view = new DataView(bytes.buffer);
  let position = 0;

  for (const [value, size] of values) {
    if (size === 2) {
      view.setUint16(position, value, true);
    } else {
      view.setUint32(position, value, true);
    }

    position += size;
  }

  return bytes;
}

/**
 * Pacote ZIP das entradas pedidas. `compress: false` guarda a entrada sem
 * compressao; comprimida, ela leva o bit 3 e o descritor de dados.
 */
export async function zipBytes(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, content, compress = true } of entries) {
    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    const nameBytes = new TextEncoder().encode(name);
    const stored = compress ? await deflateRaw(data) : data;
    const flags = compress ? 0x0808 : 0x0800;
    const method = compress ? 8 : 0;
    const crc = crc32(data);
    const header = littleEndian([
      [0x04034b50, 4], [20, 2], [flags, 2], [method, 2], [0, 2], [0, 2],
      [compress ? 0 : crc, 4], [compress ? 0 : stored.length, 4], [compress ? 0 : data.length, 4],
      [nameBytes.length, 2], [0, 2],
    ]);
    const descriptor = compress
      ? littleEndian([[0x08074b50, 4], [crc, 4], [stored.length, 4], [data.length, 4]])
      : new Uint8Array(0);

    locals.push(header, nameBytes, stored, descriptor);
    centrals.push(
      littleEndian([
        [0x02014b50, 4], [20, 2], [20, 2], [flags, 2], [method, 2], [0, 2], [0, 2],
        [crc, 4], [stored.length, 4], [data.length, 4],
        [nameBytes.length, 2], [0, 2], [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4],
      ]),
      nameBytes,
    );
    offset += header.length + nameBytes.length + stored.length + descriptor.length;
  }

  const central = concat(centrals);
  const end = littleEndian([
    [0x06054b50, 4], [0, 2], [0, 2], [entries.length, 2], [entries.length, 2],
    [central.length, 4], [offset, 4], [0, 2],
  ]);

  return concat([...locals, central, end]);
}

/** Pacote `.ods` com o `content.xml` dado. */
export function odsBytes(content, { mimetype = ODS_MIMETYPE, compressContent = true } = {}) {
  return zipBytes([
    { name: 'mimetype', content: mimetype, compress: false },
    { name: 'styles.xml', content: '<?xml version="1.0" encoding="UTF-8"?><office:document-styles/>' },
    { name: 'content.xml', content, compress: compressContent },
    { name: 'META-INF/manifest.xml', content: '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest/>' },
  ]);
}

const NAMESPACES = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0"',
].join(' ');

/** `content.xml` com as abas dadas, cada uma `{ name, rows }`. */
export function contentXml(sheets) {
  const tables = sheets
    .map(
      ({ name, rows }) =>
        `<table:table table:name="${name}"><table:table-column table:number-columns-repeated="4"/>${rows.join('')}</table:table>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NAMESPACES} office:version="1.3"><office:body><office:spreadsheet>${tables}</office:spreadsheet></office:body></office:document-content>`;
}

/** Linha com as celulas dadas; `repeat` vira `table:number-rows-repeated`. */
export function row(cells, repeat = 1) {
  const attribute = repeat > 1 ? ` table:number-rows-repeated="${repeat}"` : '';

  return `<table:table-row table:style-name="ro1"${attribute}>${cells.join('')}</table:table-row>`;
}

/** Celula de texto; `xml` entra como veio, com tags de espaco e entidades. */
export function textCell(xml) {
  return `<table:table-cell office:value-type="string" calcext:value-type="string"><text:p>${xml}</text:p></table:table-cell>`;
}

/** Celula numerica, com o numero guardado e o texto exibido. */
export function floatCell(value, shown = String(value)) {
  return `<table:table-cell office:value-type="float" office:value="${value}" calcext:value-type="float"><text:p>${shown}</text:p></table:table-cell>`;
}

export function emptyCell(repeat = 1) {
  return repeat > 1 ? `<table:table-cell table:number-columns-repeated="${repeat}"/>` : '<table:table-cell/>';
}

/** Linha vazia do fim da grade, repetida como o Calc grava. */
export function emptyRows(repeat) {
  return row([emptyCell(4)], repeat);
}

export const HEADER_ROW = row(['Código', 'Descrição', 'Cód. Barras', 'NCM'].map(textCell));

/** Linha de produto no desenho da planilha cadastral. */
export function productRow({ code, description, barcode = '', ncm }) {
  return row([
    floatCell(code),
    textCell(description),
    barcode === '' ? emptyCell() : textCell(barcode),
    textCell(ncm),
  ]);
}

/** Planilha de uma aba so, ja empacotada. */
export function singleSheetOds(rows, options) {
  return odsBytes(contentXml([{ name: 'Planilha1', rows }]), options);
}
