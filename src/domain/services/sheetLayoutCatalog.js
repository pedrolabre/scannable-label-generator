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
 * Dois modelos, e nao mais. A folha unica do perfil real e a A4, e a variante
 * em paisagem nao e enfeite: o modelo de etiqueta padrao tem 100 mm de largura,
 * que cabe uma vez na area util da folha em retrato e duas vezes na area util
 * em paisagem. E o dobro de etiqueta por folha no modelo mais usado.
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

/** O retrato e a orientacao que qualquer impressora domestica ja assume. */
export const DEFAULT_SHEET_LAYOUT_ID = 'a4-retrato';

export function listSheetLayouts() {
  return SHEET_LAYOUTS;
}

export function findSheetLayout(id) {
  return SHEET_LAYOUTS.find((layout) => layout.id === id) ?? null;
}

export function getDefaultSheetLayout() {
  return findSheetLayout(DEFAULT_SHEET_LAYOUT_ID);
}
