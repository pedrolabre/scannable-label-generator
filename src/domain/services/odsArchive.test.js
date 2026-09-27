// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { readOdsContent } from './odsArchive.js';
import { ImportFormatError } from './importError.js';
import { ODS_MIMETYPE, odsBytes, zipBytes } from './odsFixtures.js';

const CONTENT = '<?xml version="1.0" encoding="UTF-8"?><office:document-content>Fogão a gás</office:document-content>';

/** Posicao do cabecalho local da entrada, procurado pela assinatura e pelo nome. */
function localHeaderOf(bytes, name) {
  const view = new DataView(bytes.buffer);
  const wanted = new TextEncoder().encode(name);

  for (let offset = 0; offset + 30 < bytes.length; offset += 1) {
    if (
      view.getUint32(offset, true) === 0x04034b50 &&
      view.getUint16(offset + 26, true) === wanted.length &&
      wanted.every((byte, i) => bytes[offset + 30 + i] === byte)
    ) {
      return offset;
    }
  }

  return -1;
}

async function refusalOf(bytes) {
  try {
    await readOdsContent(bytes);
  } catch (error) {
    return error;
  }

  return null;
}

describe('readOdsContent', () => {
  it('le o content.xml comprimido em deflate, com os acentos do UTF-8', async () => {
    expect(await readOdsContent(await odsBytes(CONTENT))).toBe(CONTENT);
  });

  it('le o content.xml guardado sem compressao', async () => {
    expect(await readOdsContent(await odsBytes(CONTENT, { compressContent: false }))).toBe(CONTENT);
  });

  it('acha o tamanho pelo diretorio central quando o cabecalho local vem zerado', async () => {
    const bytes = await odsBytes(CONTENT);
    const view = new DataView(bytes.buffer);
    const local = localHeaderOf(bytes, 'content.xml');

    expect(view.getUint16(local + 6, true)).toBe(0x0808);
    expect(view.getUint32(local + 18, true)).toBe(0);
    expect(view.getUint32(local + 22, true)).toBe(0);
    expect(await readOdsContent(bytes)).toBe(CONTENT);
  });

  it('aceita um ArrayBuffer no lugar do Uint8Array', async () => {
    const bytes = await odsBytes(CONTENT);

    expect(await readOdsContent(bytes.buffer)).toBe(CONTENT);
  });
});

describe('readOdsContent, recusas', () => {
  it('recusa o arquivo que nao e ZIP', async () => {
    for (const bytes of [new Uint8Array(0), new TextEncoder().encode('Codigo;Descricao\n1;MESA INVENTADA\n')]) {
      const error = await refusalOf(bytes);

      expect(error).toBeInstanceOf(ImportFormatError);
      expect(error.message).toBe(
        'Planilha .ods inválida: o arquivo não é um pacote OpenDocument. Salve a planilha de novo no formato .ods.',
      );
    }
  });

  it('recusa o ZIP cortado no meio', async () => {
    const bytes = await odsBytes(CONTENT);
    const error = await refusalOf(bytes.subarray(0, bytes.length - 40));

    expect(error).toBeInstanceOf(ImportFormatError);
    expect(error.message).toMatch(/^Planilha \.ods inválida/);
  });

  it('recusa o ZIP sem content.xml', async () => {
    const bytes = await zipBytes([
      { name: 'mimetype', content: ODS_MIMETYPE, compress: false },
      { name: 'styles.xml', content: '<office:document-styles/>' },
    ]);
    const error = await refusalOf(bytes);

    expect(error).toBeInstanceOf(ImportFormatError);
    expect(error.message).toBe(
      'Planilha .ods incompleta: o pacote não traz o conteúdo da planilha (content.xml).',
    );
  });

  it('recusa o pacote OpenDocument de outro tipo e o ZIP sem mimetype', async () => {
    const text = await odsBytes(CONTENT, { mimetype: 'application/vnd.oasis.opendocument.text' });
    const withoutMimetype = await zipBytes([{ name: 'content.xml', content: CONTENT }]);

    for (const bytes of [text, withoutMimetype]) {
      const error = await refusalOf(bytes);

      expect(error).toBeInstanceOf(ImportFormatError);
      expect(error.message).toBe(
        'Arquivo OpenDocument que não é planilha: são aceitas só planilhas .ods, como as salvas pelo LibreOffice Calc.',
      );
    }
  });

  it('recusa o content.xml com os dados comprimidos estragados', async () => {
    const bytes = await odsBytes(CONTENT.repeat(20));
    const data = localHeaderOf(bytes, 'content.xml') + 30 + 'content.xml'.length;

    bytes.fill(0xff, data, data + 8);

    const error = await refusalOf(bytes);

    expect(error).toBeInstanceOf(ImportFormatError);
    expect(error.message).toBe(
      'Planilha .ods corrompida: o conteúdo da planilha não pôde ser descompactado.',
    );
  });
});
