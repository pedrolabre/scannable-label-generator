import { normalizePriceToCentavos } from '../../lib/currency.js';
import { DISPLAY_NAME_MAX_LENGTH } from '../schemas/productSchema.js';

import { IMPORT_FORMAT_XML } from './importRecord.js';
import { readNfceProductSources } from './nfceProductMapping.js';
import {
  ISSUE_DISPLAY_NAME_TRUNCATED,
  ISSUE_EAN_UNEXPECTED_LENGTH,
  ISSUE_PRICE_NEGATIVE,
  ISSUE_PRICE_UNREADABLE,
  ISSUE_SEVERITY_MISSING,
  ISSUE_SEVERITY_NOTICE,
  NO_MAPPING_ISSUES,
  createMappingIssue,
} from './productCandidateIssue.js';
import { normalizeSearchText } from './productSearch.js';
import { readTabularProductSources } from './tabularProductMapping.js';

/**
 * Traducao do registro cru para os campos do produto.
 *
 * Este e o passo entre a leitura do arquivo e a validacao: o registro entra com
 * `raw` — as chaves exatamente como vieram do arquivo — e sai com um `candidate`
 * nos nomes do `ProductSchema`, sem que `raw` nem `source` sejam tocados.
 *
 * De onde vem cada campo e assunto do formato, e mora em modulo proprio:
 * `nfceProductMapping.js` para a nota fiscal, `tabularProductMapping.js` para
 * planilha e JSON. Aqui ficam as conversoes que valem para os tres.
 *
 * A regra unica das conversoes: **so escreve o campo quem consegue produzir um
 * valor que o tipo do contrato aceita.** Quando nao consegue, o campo e omitido
 * e o motivo vai para `candidateIssues`, com o texto cru do arquivo junto. Nao
 * ha descarte em silencio — um registro que perdeu o preco precisa ser
 * distinguivel de um registro cujo arquivo nao tinha preco — e nao ha valor
 * impossivel empurrado adiante so para ser recusado com uma mensagem generica.
 *
 * A excecao e o campo cujo texto cru ja e a explicacao do erro. `systemCode`,
 * `description`, `category` e `notes` sao texto com limite, e o contrato tem a
 * frase certa para cada um: eles passam como vieram, aparados, e quem recusa e
 * a validacao.
 */

/**
 * Corte de um caractere abaixo do minimo aproveitavel: abaixo disso o resultado
 * nao lembra mais o produto, e o corte duro no limite e preferivel.
 */
const MIN_SUGGESTED_NAME_LENGTH = 3;

const TRAILING_PUNCTUATION = /[\s\-:/,.;]+$/;
const ACCEPTED_EAN = /^(\d{8}|\d{12,14})$/;
const ONLY_DIGITS = /^\d+$/;
const ABSENT_BARCODE = new Set(['sem gtin', 'semgtin', 'sem codigo', 'sem ean']);

function toText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Nome da etiqueta a partir do texto do produto.
 *
 * `xProd` da NFC-e vai ate 120 caracteres e costuma trazer marca, medidas, cor
 * e voltagem no mesmo texto; `displayName` para na metade disso. O corte
 * respeita a fronteira de palavra, porque o que vem no fim desses nomes e
 * justamente o que distingue dois produtos parecidos — descartar os ultimos
 * termos por suposicao apagaria a diferenca entre duas variantes do mesmo item.
 *
 * O texto completo nao se perde: ele continua inteiro em `description`, que tem
 * o mesmo limite de 120 da propria tag da nota.
 *
 * Quando nao ha fronteira de palavra dentro do limite — um codigo longo colado,
 * sem espaco — o corte e feito no limite mesmo. E quando o texto de origem esta
 * vazio, o nome fica vazio: o contrato ja cobra "Nome da etiqueta obrigatório"
 * com a frase certa, e inventar um marcador seria pior do que nao ter nome.
 */
export function suggestDisplayName(value) {
  const full = toText(value);

  if (full.length <= DISPLAY_NAME_MAX_LENGTH) {
    return { value: full, truncated: false };
  }

  const window = full.slice(0, DISPLAY_NAME_MAX_LENGTH + 1);
  const lastSpace = window.lastIndexOf(' ');
  const atWordBoundary = lastSpace > 0 ? window.slice(0, lastSpace).replace(TRAILING_PUNCTUATION, '') : '';

  const shortened =
    atWordBoundary.length >= MIN_SUGGESTED_NAME_LENGTH
      ? atWordBoundary
      : full.slice(0, DISPLAY_NAME_MAX_LENGTH).replace(TRAILING_PUNCTUATION, '');

  return { value: shortened, truncated: shortened.length > 0 };
}

function readDisplayName(value, issues) {
  const { value: name, truncated } = suggestDisplayName(value);

  if (truncated) {
    issues.push(
      createMappingIssue({
        field: 'displayName',
        code: ISSUE_DISPLAY_NAME_TRUNCATED,
        severity: ISSUE_SEVERITY_NOTICE,
        rawValue: toText(value),
        message: `Nome encurtado para caber em ${DISPLAY_NAME_MAX_LENGTH} caracteres. Confira antes de gravar.`,
      }),
    );
  }

  return name;
}

/**
 * Preco em centavos.
 *
 * A conversao e a mesma do preco digitado no formulario, em `src/lib/currency.js`:
 * arredondamento de meio para cima na terceira casa decimal, com a quarta
 * ignorada. A nota fiscal escreve quatro casas ("12.5000", "0.8333"), entao a
 * divergencia maxima contra o documento e de meio centavo por unidade.
 *
 * Campo de origem vazio nao gera aviso: a ausencia do preco ja e cobrada pelo
 * contrato, com a mensagem que o usuario precisa ler. Valor presente e
 * irreconhecivel, ou negativo, gera — porque ai ha algo no arquivo que so o
 * texto cru explica.
 */
function readPriceInCentavos(value, decimalSeparator, issues) {
  const text = toText(value);

  if (text === '') {
    return undefined;
  }

  const centavos = normalizePriceToCentavos(text, { decimalSeparator });

  if (centavos === null) {
    issues.push(
      createMappingIssue({
        field: 'priceInCentavos',
        code: ISSUE_PRICE_UNREADABLE,
        severity: ISSUE_SEVERITY_MISSING,
        rawValue: text,
        message: `O preço "${text}" não foi reconhecido como valor monetário.`,
      }),
    );

    return undefined;
  }

  if (centavos < 0) {
    issues.push(
      createMappingIssue({
        field: 'priceInCentavos',
        code: ISSUE_PRICE_NEGATIVE,
        severity: ISSUE_SEVERITY_MISSING,
        rawValue: text,
        message: `O preço "${text}" é negativo.`,
      }),
    );

    return undefined;
  }

  return centavos;
}

/**
 * Codigo de barras, escrito so quando tem exatamente 8, 12, 13 ou 14 digitos.
 *
 * "SEM GTIN" e o campo vazio sao ausencia de codigo, nao valor invalido: e o
 * estado normal de uma boa parte dos itens de uma nota, e `ean` e opcional no
 * contrato. Por isso passam sem aviso — um aviso a cada cinco registros seria
 * ruido, nao informacao.
 *
 * Quantidade de digitos fora das aceitas, ou conteudo que nao e numero, sao
 * outra coisa: ha um defeito no arquivo de origem, e o aviso guarda o texto
 * para que o usuario possa corrigi-lo.
 *
 * O valor nunca passa por conversao numerica, em nenhum ponto do caminho: e o
 * que preserva o zero a esquerda de um GTIN-8 ou GTIN-12.
 */
function readEan(value, issues) {
  const text = toText(value);

  if (text === '' || ABSENT_BARCODE.has(normalizeSearchText(text))) {
    return undefined;
  }

  if (ACCEPTED_EAN.test(text)) {
    return text;
  }

  issues.push(
    createMappingIssue({
      field: 'ean',
      code: ISSUE_EAN_UNEXPECTED_LENGTH,
      severity: ISSUE_SEVERITY_MISSING,
      rawValue: text,
      message: ONLY_DIGITS.test(text)
        ? `Código de barras com ${text.length} dígitos; são aceitos 8, 12, 13 ou 14.`
        : `O código de barras "${text}" não é composto apenas de dígitos.`,
    }),
  );

  return undefined;
}

function readSourcesFor(record) {
  return record.source.format === IMPORT_FORMAT_XML
    ? readNfceProductSources(record.raw ?? {})
    : readTabularProductSources(record.raw ?? {});
}

/**
 * Campos do produto a partir do registro cru, com os avisos do caminho. Campo
 * de texto opcional vazio fica de fora do objeto em vez de entrar como texto
 * vazio, para que o produto gravado no fim nao carregue campo em branco.
 */
export function mapRecordToCandidate(record) {
  const { sources, priceDecimalSeparator, issues: formatIssues } = readSourcesFor(record);
  const issues = [...formatIssues];

  const candidate = {
    systemCode: toText(sources.systemCode),
    displayName: readDisplayName(sources.displayName, issues),
  };

  const price = readPriceInCentavos(sources.priceInCentavos, priceDecimalSeparator, issues);

  if (price !== undefined) {
    candidate.priceInCentavos = price;
  }

  const ean = readEan(sources.ean, issues);

  if (ean !== undefined) {
    candidate.ean = ean;
  }

  for (const field of ['description', 'category', 'notes']) {
    const text = toText(sources[field]);

    if (text !== '') {
      candidate[field] = text;
    }
  }

  return { candidate, issues: issues.length === 0 ? NO_MAPPING_ISSUES : issues };
}

/**
 * Registro com os campos do produto acrescentados. `raw` e `source` continuam
 * como estavam: o motivo da recusa so vale ao lado do valor que a provocou, e a
 * procedencia continua sendo o endereco do registro dentro do lote.
 */
export function attachProductCandidate(record) {
  const { candidate, issues } = mapRecordToCandidate(record);

  return { ...record, candidate, candidateIssues: issues };
}
