import { ImportFormatError } from './importError.js';
import { IMPORT_FORMAT_XML, createImportRecord } from './importRecord.js';

/**
 * Leitura do XML de NFC-e com o `DOMParser` do proprio navegador, sem
 * biblioteca de XML.
 *
 * O modulo desce um caminho explicito — `nfeProc > NFe > infNFe > det > prod` —
 * e devolve, por item da nota, apenas as tags filhas diretas de `<prod>`, em
 * texto cru. Nenhum outro ramo do documento e lido, copiado ou serializado:
 * `emit`, `dest`, `imposto`, `total`, `transp`, `pag`, `infAdic`, `infRespTec`,
 * `Signature`, `infNFeSupl` e `protNFe` ficam no documento que sai de escopo ao
 * fim da funcao. E por isso que nome, CPF e endereco de cliente, impostos,
 * assinatura e certificado nao existem em nenhum ponto do fluxo seguinte —
 * a garantia esta aqui, na porta de entrada, e nao num descarte posterior.
 *
 * O mapeamento dos campos de produto e a conversao de valores acontecem
 * depois; este modulo nao renomeia nem interpreta nada.
 */

const NFCE_ROOT_TAG = 'nfeProc';
const NFE_NAMESPACE = 'http://www.portalfiscal.inf.br/nfe';

function localNameOf(element) {
  return element.localName ?? String(element.nodeName).replace(/^.*:/, '');
}

function childrenByLocalName(element, name) {
  return Array.from(element.children).filter((child) => localNameOf(child) === name);
}

function firstChildByLocalName(element, name) {
  return childrenByLocalName(element, name)[0] ?? null;
}

/**
 * O `DOMParser` nao lanca excecao em XML quebrado: ele devolve um documento
 * cujo conteudo e um `<parsererror>` descrevendo a falha.
 */
function hasSyntaxError(document) {
  const root = document.documentElement;

  if (!root) {
    return true;
  }

  return localNameOf(root) === 'parsererror' || document.getElementsByTagName('parsererror').length > 0;
}

/**
 * Le os campos de produto de um `<prod>`: nome da tag como chave, texto como
 * valor. Tag repetida mantem a primeira ocorrencia, e nenhuma chave e criada
 * fora das filhas diretas do proprio `<prod>`.
 */
function readProductFields(product) {
  const fields = {};

  for (const field of product.children) {
    const name = localNameOf(field);

    if (!(name in fields)) {
      fields[name] = (field.textContent ?? '').trim();
    }
  }

  return fields;
}

export function parseNfceDocument(xmlText, { fileName, fileIndex }) {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml');

  if (hasSyntaxError(document)) {
    throw new ImportFormatError('XML malformado: o arquivo não pôde ser lido.');
  }

  const root = document.documentElement;
  const rootName = localNameOf(root);

  if (rootName !== NFCE_ROOT_TAG) {
    throw new ImportFormatError(
      `XML fora do formato de NFC-e: o elemento raiz é <${rootName}>, e não <${NFCE_ROOT_TAG}>.`,
    );
  }

  // Arquivo sem namespace declarado continua aceito, porque exportadores mais
  // antigos o omitem; namespace declarado e diferente do da SEFAZ e recusa.
  if (root.namespaceURI && root.namespaceURI !== NFE_NAMESPACE) {
    throw new ImportFormatError('XML fora do formato de NFC-e: o documento não usa o padrão da SEFAZ.');
  }

  const nfe = firstChildByLocalName(root, 'NFe');
  const invoice = nfe ? firstChildByLocalName(nfe, 'infNFe') : null;

  if (!invoice) {
    throw new ImportFormatError('XML fora do formato de NFC-e: não foi encontrado o elemento <infNFe>.');
  }

  const items = childrenByLocalName(invoice, 'det');

  if (items.length === 0) {
    throw new ImportFormatError('Nenhum item de produto foi encontrado nesta nota.');
  }

  return items.map((item, index) => {
    const itemNumber = item.getAttribute('nItem');
    const product = firstChildByLocalName(item, 'prod');

    if (!product) {
      throw new ImportFormatError(
        `XML fora do formato de NFC-e: o item ${itemNumber ?? index + 1} não contém o elemento <prod>.`,
      );
    }

    return createImportRecord({
      fileName,
      fileIndex,
      format: IMPORT_FORMAT_XML,
      index,
      itemNumber,
      raw: readProductFields(product),
    });
  });
}
