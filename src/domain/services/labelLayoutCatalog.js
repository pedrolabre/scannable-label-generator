/**
 * Catalogo dos modelos de etiqueta, em milimetros reais.
 *
 * E constante de codigo, e nao linha de banco. O usuario nao edita modelo de
 * etiqueta, entao uma tabela mutavel so criaria perguntas sem resposta boa:
 * quem semeia, quando semeia, e o que acontece com a impressao no dia em que
 * uma linha for apagada. Como constante o catalogo esta pronto antes de
 * qualquer leitura de armazenamento, e nao ha linha para apagar. A tabela do
 * banco fica reservada para o dia em que existirem modelos do proprio usuario.
 *
 * `symbolSizeMm` e o lado da caixa inteira do simbolo, com a zona de silencio
 * ja dentro dela. Os tres modelos ficam acima do alvo de 0,6 mm por modulo, e
 * nao apenas acima do piso de 0,5 mm.
 *
 * Cada modelo e conferido duas vezes no carregamento deste modulo: pelo
 * contrato do modelo e pelo calculo de zonas. Modelo que nao passa derruba o
 * carregamento em vez de chegar a tela como etiqueta ilegivel.
 */

import { LabelLayoutSchema } from '../schemas/labelLayoutSchema.js';

import { computeLabelGeometry } from './labelGeometry.js';

const DEFINITIONS = [
  {
    id: 'tag-grande',
    name: 'Tag grande (100 x 70 mm)',
    widthMm: 100,
    heightMm: 70,
    paddingMm: 4,
    symbolSizeMm: 36,
  },
  {
    id: 'etiqueta-media',
    name: 'Etiqueta média (70 x 50 mm)',
    widthMm: 70,
    heightMm: 50,
    paddingMm: 3,
    symbolSizeMm: 28,
  },
  {
    id: 'etiqueta-pequena',
    name: 'Etiqueta pequena (50 x 30 mm)',
    widthMm: 50,
    heightMm: 30,
    paddingMm: 2,
    symbolSizeMm: 20,
  },
];

function buildCatalog() {
  return DEFINITIONS.map((definition) => {
    const parsed = LabelLayoutSchema.safeParse(definition);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      throw new Error(`O modelo de etiqueta "${definition.id}" e invalido: ${issue.message}`);
    }

    // Lanca quando o modelo nao comporta o contrato visual completo.
    computeLabelGeometry(parsed.data);

    return Object.freeze(parsed.data);
  });
}

export const LABEL_LAYOUTS = Object.freeze(buildCatalog());

/**
 * O perfil real de produto e movel e eletrodomestico, entao a tag grande e o
 * ponto de partida; os tamanhos menores sao a excecao escolhida a mao.
 */
export const DEFAULT_LABEL_LAYOUT_ID = 'tag-grande';

export function listLabelLayouts() {
  return LABEL_LAYOUTS;
}

export function findLabelLayout(id) {
  return LABEL_LAYOUTS.find((layout) => layout.id === id) ?? null;
}

export function getDefaultLabelLayout() {
  return findLabelLayout(DEFAULT_LABEL_LAYOUT_ID);
}
