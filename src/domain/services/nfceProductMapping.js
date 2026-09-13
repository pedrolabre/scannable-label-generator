import {
  ISSUE_PRICE_NOT_UNITARY,
  ISSUE_SEVERITY_MISSING,
  createMappingIssue,
} from './productCandidateIssue.js';
import { normalizeSearchText } from './productSearch.js';

/**
 * De onde vem cada campo do produto quando o registro saiu de uma NFC-e, e as
 * regras que so valem para a nota fiscal.
 *
 * O modulo trabalha exclusivamente sobre as tags filhas de `<prod>` que a
 * leitura do XML ja separou. Ele nao reabre o documento, nao conhece outro ramo
 * da nota e nao tem como alcancar emitente, destinatario, imposto, total,
 * assinatura ou responsavel tecnico: esses campos nao existem no registro que
 * chega aqui.
 *
 * A nota nao traz origem para `category` nem para `notes`, entao esses dois
 * campos ficam de fora do candidato vindo de XML.
 */

/**
 * Unidades de medida continua. Quando a nota cobra por uma delas, `vUnCom` e o
 * preco de um quilo, de um metro ou de um litro — nao o preco do que vai ser
 * etiquetado. O preco entao nao e aproveitado, e o aviso pede o valor certo.
 *
 * A lista nomeia as medidas continuas em vez de nomear as unidades aceitas, e
 * isso e deliberado: uma abreviacao de contagem nao prevista ("UND", "PCT",
 * "CJ") passa a valer, em vez de ser bloqueada em silencio por nao constar de
 * uma lista de permissao.
 */
const CONTINUOUS_UNITS = new Set([
  'kg',
  'g',
  'mg',
  'ton',
  'l',
  'lt',
  'ml',
  'm',
  'mt',
  'm2',
  'm3',
  'cm',
  'mm',
]);

function isUnitaryPrice(unit) {
  const normalized = normalizeSearchText(unit);

  return normalized === '' || !CONTINUOUS_UNITS.has(normalized);
}

export function readNfceProductSources(raw) {
  const unit = raw.uCom ?? '';
  const unitary = isUnitaryPrice(unit);
  const issues = [];

  if (!unitary) {
    issues.push(
      createMappingIssue({
        field: 'priceInCentavos',
        code: ISSUE_PRICE_NOT_UNITARY,
        severity: ISSUE_SEVERITY_MISSING,
        rawValue: `${raw.vUnCom ?? ''} por ${unit.trim()}`,
        message: `A nota cobra por ${unit.trim().toUpperCase()}, e não por unidade. Informe o preço da etiqueta.`,
      }),
    );
  }

  return {
    sources: {
      systemCode: raw.cProd,
      displayName: raw.xProd,
      description: raw.xProd,
      ean: raw.cEAN,
      // Preco de unidade continua fica de fora com o motivo ja escrito acima;
      // deixa-lo passar imprimiria o preco do quilo numa etiqueta de unidade.
      priceInCentavos: unitary ? raw.vUnCom : undefined,
    },
    // A nota fiscal escreve o valor em formato de maquina ("1799.0000"), com
    // ponto decimal sempre. Nao ha ambiguidade a resolver por deteccao.
    priceDecimalSeparator: '.',
    issues,
  };
}
