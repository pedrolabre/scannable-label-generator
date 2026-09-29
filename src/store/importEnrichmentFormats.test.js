import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bytesOf, footer, priceHeader, priceRow } from '../domain/services/txtReportFixtures.js';

/**
 * Todos os formatos da importacao passam pela base de referencia, sempre so
 * nos campos vazios. O ambiente e o de DOM porque a nota fiscal usa o
 * `DOMParser` do navegador.
 */

const products = vi.hoisted(() => ({
  clearAllProducts: vi.fn(),
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listProducts: vi.fn(),
  replaceAllProducts: vi.fn(),
  runProductsTransaction: vi.fn(),
  updateProduct: vi.fn(),
  updateProducts: vi.fn(),
}));

const references = vi.hoisted(() => ({
  clearReferenceEntries: vi.fn(),
  findReference: vi.fn(),
  findReferences: vi.fn(),
  getReferenceStats: vi.fn(),
  replaceReferenceEntries: vi.fn(),
}));

vi.mock('../storage/productRepository.js', () => products);
vi.mock('../storage/referenceRepository.js', () => references);

const { useImportStore } = await import('./useImportStore.js');

const BASE = new Map([
  ['1620', { systemCode: '1620', ncm: '94035000', ean: '7890000000017' }],
  ['2040', { systemCode: '2040', ncm: '94016100', ean: '7890000000048' }],
  ['3050', { systemCode: '3050', ncm: '85166000', ean: '7890000000055' }],
  ['4060', { systemCode: '4060', ncm: '94036000', ean: '7890000000062' }],
]);

const CSV_CONTENT = [
  'codigo,nome,preco,ncm,ean',
  '1620,GUARDA ROUPA INVENTADO,"1.299,90",94036000,',
  '2040,SOFA INVENTADO,"999,00",,7890000000079',
].join('\n');

const JSON_CONTENT = JSON.stringify([{ codigo: '3050', nome: 'FORNO INVENTADO', preco: '599,00' }]);

const NOTE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe versao="4.00">
      <det nItem="1">
        <prod>
          <cProd>4060</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>RACK INVENTADO</xProd>
          <NCM>94039000</NCM>
          <uCom>UN</uCom>
          <vUnCom>349.9000</vUnCom>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

const PRICE_REPORT = bytesOf([
  ...priceHeader(1),
  priceRow({ code: '01620', description: 'GUARDA ROUPA INVENTADO 6PTS', price: '1.299,90' }),
  ...footer(1),
]);

function fileFrom(name, content) {
  return new File([content], name, { type: 'application/octet-stream' });
}

beforeEach(() => {
  vi.clearAllMocks();
  useImportStore.getState().reset();
  products.listProducts.mockResolvedValue([]);
  references.findReferences.mockImplementation(async (codes) => {
    const found = new Map();

    for (const code of codes) {
      const reference = BASE.get(code.replace(/^0+(?=\d)/, ''));

      if (reference) {
        found.set(code, reference);
      }
    }

    return found;
  });
});

describe('formatos enriquecidos', () => {
  it('completa CSV, JSON, nota fiscal e relatorio em texto, so nos campos vazios', async () => {
    await useImportStore.getState().parseFiles([
      fileFrom('planilha.csv', CSV_CONTENT),
      fileFrom('lista.json', JSON_CONTENT),
      fileFrom('nota.xml', NOTE),
      fileFrom('tabela.txt', PRICE_REPORT),
    ]);

    const { records, files } = useImportStore.getState();
    const byCode = new Map(records.map((record) => [record.candidate.systemCode, record]));

    expect(files.map((file) => file.format)).toEqual(['csv', 'json', 'xml', 'txt']);
    expect(references.findReferences).toHaveBeenCalledTimes(1);

    // CSV: o NCM do arquivo fica, o codigo de barras vazio vem da base.
    expect(byCode.get('1620').candidate).toEqual(expect.objectContaining({ ncm: '94036000', ean: '7890000000017' }));
    expect(byCode.get('1620').enrichedFields).toEqual(['ean']);
    // CSV: o codigo de barras do arquivo fica, o NCM vazio vem da base.
    expect(byCode.get('2040').candidate).toEqual(expect.objectContaining({ ncm: '94016100', ean: '7890000000079' }));
    expect(byCode.get('2040').enrichedFields).toEqual(['ncm']);
    // JSON: os dois vazios vem da base.
    expect(byCode.get('3050').enrichedFields).toEqual(['ncm', 'ean']);
    // Nota fiscal: o NCM da nota fica, o "SEM GTIN" e ausencia e vem da base.
    expect(byCode.get('4060').candidate).toEqual(expect.objectContaining({ ncm: '94039000', ean: '7890000000062' }));
    expect(byCode.get('4060').enrichedFields).toEqual(['ean']);
    // Relatorio em texto: o codigo com zero a esquerda acha a linha.
    expect(byCode.get('01620').enrichedFields).toEqual(['ncm', 'ean']);
  });
});
