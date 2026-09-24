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
 * ja dentro dela. A caixa e dimensionada para o maior texto que o simbolo
 * aceita, 53 modulos com a zona: 27 mm deixam o modulo acima do piso de 0,5 mm
 * nesse pior caso, e o texto tipico, de 41 modulos, sai com 0,66 mm. A tag
 * grande tem espaco para 32 mm, e ali o pior caso alcanca o alvo de 0,6 mm.
 *
 * A etiqueta de 10 por folha tem a medida do formulario de preco que a
 * operacao ja usa, 84,7 x 46,6 mm, para sair no mesmo lugar da folha antiga.
 * Nessa altura o nome do produto fica numa linha so, acima do simbolo.
 *
 * A etiqueta pequena tem margem menor porque o simbolo precisa da altura util
 * inteira: 30 mm de altura menos duas margens de 1,5 mm sao os 27 mm da caixa.
 *
 * Cada modelo e conferido duas vezes no carregamento deste modulo: pelo
 * contrato do modelo e pelo calculo de zonas. Modelo que nao passa derruba o
 * carregamento em vez de chegar a tela como etiqueta ilegivel.
 */

import { LabelLayoutSchema } from '../schemas/labelLayoutSchema.js';

import { computeLabelGeometry } from './labelGeometry.js';

const DEFINITIONS = [
  {
    id: 'etiqueta-media-10',
    name: 'Etiqueta 10 (84,7 x 46,6 mm)',
    widthMm: 84.7,
    heightMm: 46.6,
    paddingMm: 2.5,
    symbolSizeMm: 27,
  },
  {
    id: 'tag-grande',
    name: 'Tag grande (100 x 70 mm)',
    widthMm: 100,
    heightMm: 70,
    paddingMm: 4,
    symbolSizeMm: 32,
  },
  {
    id: 'etiqueta-media',
    name: 'Etiqueta média (70 x 50 mm)',
    widthMm: 70,
    heightMm: 50,
    paddingMm: 3,
    symbolSizeMm: 27,
  },
  {
    id: 'etiqueta-pequena',
    name: 'Etiqueta pequena (50 x 30 mm)',
    widthMm: 50,
    heightMm: 30,
    paddingMm: 1.5,
    symbolSizeMm: 27,
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
 * A etiqueta de 10 por folha e o ponto de partida porque e a que a operacao ja
 * recorta da folha A4; os outros tamanhos sao a excecao escolhida a mao. O
 * modelo padrao vem primeiro na lista, que e a ordem dos botoes.
 */
export const DEFAULT_LABEL_LAYOUT_ID = 'etiqueta-media-10';

export function listLabelLayouts() {
  return LABEL_LAYOUTS;
}

export function findLabelLayout(id) {
  return LABEL_LAYOUTS.find((layout) => layout.id === id) ?? null;
}

export function getDefaultLabelLayout() {
  return findLabelLayout(DEFAULT_LABEL_LAYOUT_ID);
}
