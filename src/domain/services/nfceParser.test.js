import { describe, expect, it } from 'vitest';

import { ProductSchema } from '../schemas/productSchema.js';

import { ImportFormatError } from './importError.js';
import { describeRecord } from './importReport.js';
import { createImportReport, pushRecordReport } from './importReportIndex.js';
import { validateCandidate } from './importValidation.js';
import { writeImportBatch } from './importWriter.js';
import { parseNfceDocument } from './nfceParser.js';
import { attachProductCandidate } from './productMapping.js';

/**
 * Toda nota usada aqui e escrita a mao, com valores inventados. Os marcadores
 * abaixo aparecem nos ramos do documento que o leitor nao deve tocar, e sao o
 * que o teste de vazamento procura no resultado.
 */
const FAKE_CUSTOMER_NAME = 'FULANO DE TAL INVENTADO';
const FAKE_CUSTOMER_DOCUMENT = '11111111111';
const FAKE_CUSTOMER_ADDRESS = 'RUA INVENTADA NUMERO ZERO';
const FAKE_SIGNATURE = 'ASSINATURA-INVENTADA-PARA-TESTE';
const FAKE_TAX_VALUE = '987654321';

function buildItem({ number, code, barcode, name, price }) {
  return `
    <det nItem="${number}">
      <prod>
        <cProd>${code}</cProd>
        <cEAN>${barcode}</cEAN>
        <xProd>${name}</xProd>
        <NCM>00000000</NCM>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>1.0000</qCom>
        <vUnCom>${price}</vUnCom>
        <vProd>${price}</vProd>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN102>
            <vICMS>${FAKE_TAX_VALUE}</vICMS>
          </ICMSSN102>
        </ICMS>
      </imposto>
    </det>`;
}

function buildNfce({ items, namespace = 'http://www.portalfiscal.inf.br/nfe' } = {}) {
  const namespaceAttribute = namespace ? ` xmlns="${namespace}"` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc${namespaceAttribute} versao="4.00">
  <NFe>
    <infNFe Id="NFe00000000000000000000000000000000000000000000" versao="4.00">
      <ide>
        <mod>65</mod>
        <nNF>1</nNF>
      </ide>
      <emit>
        <CNPJ>00000000000191</CNPJ>
        <xNome>EMPRESA INVENTADA LTDA</xNome>
      </emit>
      <dest>
        <CPF>${FAKE_CUSTOMER_DOCUMENT}</CPF>
        <xNome>${FAKE_CUSTOMER_NAME}</xNome>
        <enderDest>
          <xLgr>${FAKE_CUSTOMER_ADDRESS}</xLgr>
        </enderDest>
      </dest>
${items.map(buildItem).join('\n')}
      <total>
        <ICMSTot>
          <vNF>${FAKE_TAX_VALUE}</vNF>
        </ICMSTot>
      </total>
      <infRespTec>
        <email>contato@inventado.invalido</email>
      </infRespTec>
    </infNFe>
    <Signature>
      <SignatureValue>${FAKE_SIGNATURE}</SignatureValue>
    </Signature>
  </NFe>
</nfeProc>`;
}

const TWO_ITEM_NOTE = buildNfce({
  items: [
    { number: '1', code: 'ABC-1', barcode: '7890000000001', name: 'PRODUTO INVENTADO UM', price: '12.5000' },
    { number: '2', code: 'ABC-2', barcode: 'SEM GTIN', name: 'PRODUTO INVENTADO DOIS', price: '3.9900' },
  ],
});

const ORIGIN = { fileName: 'nota-inventada.xml', fileIndex: 0 };

describe('parseNfceDocument', () => {
  it('devolve um registro por item da nota, com a procedencia de cada um', () => {
    const records = parseNfceDocument(TWO_ITEM_NOTE, ORIGIN);

    expect(records).toHaveLength(2);
    expect(records[0].recordId).toBe('0:0');
    expect(records[0].source).toEqual({
      fileName: 'nota-inventada.xml',
      fileIndex: 0,
      format: 'xml',
      index: 0,
      itemNumber: '1',
    });
    expect(records[1].source.itemNumber).toBe('2');
  });

  it('guarda os campos do produto como texto, sem renomear nem converter', () => {
    const [first, second] = parseNfceDocument(TWO_ITEM_NOTE, ORIGIN);

    expect(first.raw.cProd).toBe('ABC-1');
    expect(first.raw.vUnCom).toBe('12.5000');
    expect(first.raw.xProd).toBe('PRODUTO INVENTADO UM');
    expect(second.raw.cEAN).toBe('SEM GTIN');
  });

  it('limita as chaves do registro as tags filhas de prod', () => {
    const [first] = parseNfceDocument(TWO_ITEM_NOTE, ORIGIN);

    expect(Object.keys(first.raw)).toEqual([
      'cProd',
      'cEAN',
      'xProd',
      'NCM',
      'CFOP',
      'uCom',
      'qCom',
      'vUnCom',
      'vProd',
      'indTot',
    ]);
  });

  it('nao deixa passar dado de cliente, imposto, total nem assinatura', async () => {
    // O terceiro item existe para que a conferencia tenha o que dizer: o codigo
    // de barras curto produz um aviso com o texto cru do arquivo, e e esse
    // caminho — mensagem e valor original chegando ao relatorio — que precisa
    // ser conferido junto dos outros dois.
    const note = buildNfce({
      items: [
        { number: '1', code: 'ABC-1', barcode: '7890000000001', name: 'PRODUTO INVENTADO UM', price: '12.5000' },
        { number: '2', code: 'ABC-2', barcode: 'SEM GTIN', name: 'PRODUTO INVENTADO DOIS', price: '3.9900' },
        { number: '3', code: 'ABC-3', barcode: '123', name: 'PRODUTO INVENTADO TRES', price: '7.7700' },
      ],
    });

    const records = parseNfceDocument(note, ORIGIN);
    const translated = records.map(attachProductCandidate);

    // O relatorio que o usuario le antes de gravar, montado uma vez e usado
    // tanto na conferencia do vazamento quanto na gravacao logo abaixo.
    const report = createImportReport();

    translated.forEach((record, index) => {
      pushRecordReport(
        report,
        describeRecord(record, validateCandidate(record.candidate), index),
      );
    });

    // O produto entregue a escrita: o ultimo ponto do fluxo, e o unico cujo
    // conteudo sobrevive ao fim do lote.
    const written = [];

    await writeImportBatch(translated, {
      report,
      repository: {
        runProductsTransaction: (write) => write(),
        createProduct: async (product) => {
          written.push(ProductSchema.parse(product));

          return product;
        },
        updateProduct: async (product) => product,
      },
    });

    expect(written).toHaveLength(3);

    // As quatro formas que o registro assume no fluxo: como saiu da leitura, como
    // fica depois da traducao para os campos do produto, como aparece no
    // relatorio, e como chega ao armazenamento.
    const serializations = [
      JSON.stringify(records),
      JSON.stringify(translated),
      JSON.stringify([...report.entries.values()]),
      JSON.stringify(written),
    ];

    for (const serialized of serializations) {
      for (const leak of [
        FAKE_CUSTOMER_NAME,
        FAKE_CUSTOMER_DOCUMENT,
        FAKE_CUSTOMER_ADDRESS,
        FAKE_SIGNATURE,
        FAKE_TAX_VALUE,
        'EMPRESA INVENTADA LTDA',
        'contato@inventado.invalido',
      ]) {
        expect(serialized).not.toContain(leak);
      }

      for (const tag of ['dest', 'emit', 'imposto', 'total', 'Signature', 'infRespTec', 'CPF']) {
        expect(serialized).not.toContain(tag);
      }
    }
  });

  it('reduz o registro traduzido aos campos do produto, sem chave alheia ao contrato', () => {
    const [first, second] = parseNfceDocument(TWO_ITEM_NOTE, ORIGIN).map(attachProductCandidate);

    expect(Object.keys(first)).toEqual(['recordId', 'source', 'raw', 'candidate', 'candidateIssues']);
    expect(Object.keys(first.candidate).sort()).toEqual([
      'description',
      'displayName',
      'ean',
      'ncm',
      'priceInCentavos',
      'systemCode',
    ]);
    expect(first.candidate.priceInCentavos).toBe(1250);
    expect(first.candidate.ncm).toBe('00000000');
    expect(second.candidate).not.toHaveProperty('ean');
  });

  it('aceita nota sem namespace declarado', () => {
    const records = parseNfceDocument(buildNfce({ items: [{ number: '1', code: 'A', barcode: '1', name: 'B', price: '1' }], namespace: null }), ORIGIN);

    expect(records).toHaveLength(1);
  });

  it('recusa documento com namespace de outro padrao', () => {
    const note = buildNfce({
      items: [{ number: '1', code: 'A', barcode: '1', name: 'B', price: '1' }],
      namespace: 'http://exemplo.invalido/outro',
    });

    expect(() => parseNfceDocument(note, ORIGIN)).toThrow(ImportFormatError);
  });

  it('recusa XML malformado', () => {
    expect(() => parseNfceDocument('<nfeProc><NFe>', ORIGIN)).toThrow(ImportFormatError);
  });

  it('recusa XML cuja raiz nao e nfeProc', () => {
    expect(() => parseNfceDocument('<catalogo><produto/></catalogo>', ORIGIN)).toThrow(
      /elemento raiz/,
    );
  });

  it('recusa nota sem nenhum item', () => {
    expect(() => parseNfceDocument(buildNfce({ items: [] }), ORIGIN)).toThrow(/item de produto/);
  });
});
