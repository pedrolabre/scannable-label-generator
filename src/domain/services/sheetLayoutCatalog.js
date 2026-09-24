/**
 * Catalogo dos modelos de folha, em milimetros reais.
 *
 * E constante de codigo, e nao linha de banco, pela mesma razao do catalogo de
 * etiquetas: ninguem semeia a tabela, e o dia em que uma linha for apagada a
 * impressao quebra sem resposta boa. Como constante o catalogo esta pronto
 * antes de qualquer leitura de armazenamento, e nao ha linha para apagar. A
 * tabela `sheetLayouts` fica reservada para o dia em que existirem folhas do
 * proprio usuario.
 *
 * Tres modelos. A folha de 10 etiquetas e a que a operacao ja usa: um
 * formulario de preco repetido duas colunas por cinco linhas numa A4 comum,
 * impresso a 100% e recortado a tesoura. Os numeros dela reproduzem a posicao
 * da folha antiga: margem de 12,7 mm nos quatro lados, 13,9 mm entre as colunas
 * e 6,5 mm entre as linhas, com a sobra a direita e embaixo, como no documento
 * original. O retrato e o paisagem de margem estreita ficam para os outros
 * modelos de etiqueta: a tag grande tem 100 mm de largura, cabe uma vez na
 * largura util em retrato e duas vezes em paisagem.
 *
 * As margens e os espacamentos declarados aqui sao o ponto de partida, e nao um
 * limite: a borda nao imprimivel muda de impressora para impressora, entao o
 * operador ajusta os seis numeros na tela e o modelo escolhido apenas repoe os
 * valores iniciais.
 *
 * Cada modelo e conferido no carregamento deste modulo pelo contrato da folha.
 * Modelo que nao passa derruba o carregamento em vez de chegar a tela como
 * folha sem area util.
 */

import { SheetLayoutSchema } from '../schemas/sheetLayoutSchema.js';

const DEFINITIONS = [
  {
    id: 'a4-10-etiquetas',
    name: 'A4 10 etiquetas (2 x 5)',
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 12.7,
    marginRightMm: 12.7,
    marginBottomMm: 12.7,
    marginLeftMm: 12.7,
    columnGapMm: 13.9,
    rowGapMm: 6.5,
  },
  {
    id: 'a4-retrato',
    name: 'A4 retrato (210 x 297 mm)',
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 10,
    marginRightMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
    columnGapMm: 3,
    rowGapMm: 3,
  },
  {
    id: 'a4-paisagem',
    name: 'A4 paisagem (297 x 210 mm)',
    widthMm: 297,
    heightMm: 210,
    marginTopMm: 10,
    marginRightMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
    columnGapMm: 3,
    rowGapMm: 3,
  },
];

function buildCatalog() {
  return DEFINITIONS.map((definition) => {
    const parsed = SheetLayoutSchema.safeParse(definition);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      throw new Error(`O modelo de folha "${definition.id}" e invalido: ${issue.message}`);
    }

    return Object.freeze(parsed.data);
  });
}

export const SHEET_LAYOUTS = Object.freeze(buildCatalog());

/**
 * A folha de 10 etiquetas e o ponto de partida porque e a folha que a operacao
 * ja imprime e recorta: a etiqueta padrao sai nela na mesma posicao de antes.
 * O modelo padrao vem primeiro na lista, que e a ordem dos botoes.
 */
export const DEFAULT_SHEET_LAYOUT_ID = 'a4-10-etiquetas';

export function listSheetLayouts() {
  return SHEET_LAYOUTS;
}

export function findSheetLayout(id) {
  return SHEET_LAYOUTS.find((layout) => layout.id === id) ?? null;
}

export function getDefaultSheetLayout() {
  return findSheetLayout(DEFAULT_SHEET_LAYOUT_ID);
}
