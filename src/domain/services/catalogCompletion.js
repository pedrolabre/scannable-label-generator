import { ProductSchema } from '../schemas/productSchema.js';

/**
 * Complementacao do catalogo: o arquivo so preenche o que esta vazio no produto
 * que ja existe.
 *
 * A regra inteira cabe em tres frases:
 *
 * - produto nenhum e criado: codigo do arquivo que nao existe no catalogo e
 *   ignorado e contado;
 * - campo preenchido no produto fica como esta, mesmo que o arquivo traga outro
 *   valor;
 * - campo vazio no produto recebe o valor do arquivo, desde que o valor passe
 *   pelo contrato do produto.
 *
 * Os campos que podem ser completados sao os opcionais do contrato. Nome da
 * etiqueta e preco sao obrigatorios, entao nunca estao vazios num produto
 * gravado; o codigo e a propria chave da comparacao.
 *
 * ## A comparacao dos codigos
 *
 * O mesmo produto aparece com zeros a esquerda num relatorio do ERP e sem eles
 * noutro, ou na planilha cadastral. O codigo gravado continua como veio, e a
 * comparacao e feita pelo codigo inteiro primeiro e, se ele nao existir no
 * catalogo, pelo codigo numerico sem os zeros a esquerda. Codigo com letra ou
 * hifen so e comparado inteiro. Quando o codigo sem zeros aponta para mais de
 * um produto do catalogo, o registro e ignorado e contado: escolher um dos dois
 * seria adivinhar.
 *
 * ## O que e contado
 *
 * Cada codigo do arquivo cai em exatamente uma destas situacoes: ganha algum
 * campo, ja estava completo, esta fora do catalogo, aponta para mais de um
 * produto ou se repete no arquivo. Por campo, o resumo conta quantos produtos o
 * ganham, quantos ja o tinham preenchido e quantos valores do arquivo foram
 * recusados pelo contrato. O registro repetido no arquivo — pelo codigo
 * comparado — so vale na primeira vez em que aparece.
 */

export const COMPLETABLE_FIELDS = Object.freeze(['description', 'ean', 'ncm', 'category', 'notes']);

const NUMERIC_CODE = /^\d+$/;

/**
 * Codigo como ele e comparado quando o codigo inteiro nao bate: so digitos,
 * sem os zeros a esquerda, e um zero sozinho quando so havia zeros.
 */
export function comparableCode(code) {
  const text = typeof code === 'string' ? code.trim() : '';

  return NUMERIC_CODE.test(text) ? text.replace(/^0+(?=\d)/, '') : text;
}

function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function emptyCounts() {
  return Object.fromEntries(COMPLETABLE_FIELDS.map((field) => [field, 0]));
}

function indexCatalog(products) {
  const byCode = new Map();
  const byComparable = new Map();

  for (const product of products) {
    byCode.set(product.systemCode, product);

    const key = comparableCode(product.systemCode);
    const found = byComparable.get(key);

    byComparable.set(key, found ? [...found, product] : [product]);
  }

  return { byCode, byComparable };
}

function findProduct(index, code) {
  const exact = index.byCode.get(code);

  if (exact) {
    return { product: exact };
  }

  const matches = index.byComparable.get(comparableCode(code)) ?? [];

  if (matches.length > 1) {
    return { ambiguous: true };
  }

  return { product: matches[0] ?? null };
}

/**
 * Valor do arquivo para um campo, ou o motivo de nao haver um. Aviso da
 * traducao para o campo e o proprio valor recusado pelo contrato contam como
 * valor invalido; campo ausente no registro nao conta como nada.
 */
function readFileValue(record, field) {
  if ((record.candidateIssues ?? []).some((issue) => issue.field === field)) {
    return { invalid: true };
  }

  const value = record.candidate?.[field];

  if (isEmpty(value)) {
    return { absent: true };
  }

  const parsed = ProductSchema.shape[field].safeParse(value);

  return parsed.success ? { value: parsed.data } : { invalid: true };
}

/**
 * O que a complementacao muda, calculado sem tocar em armazenamento nenhum.
 *
 * `products` e o catalogo como esta; `records` sao os registros ja traduzidos
 * pelo importador, com `candidate` e `candidateIssues`. Devolve os produtos que
 * mudam, ja com os campos novos e o `updatedAt` do momento, e o resumo das
 * contagens. Produto que nao ganha campo nenhum nao entra na lista e nao tem o
 * `updatedAt` tocado.
 */
export function planCatalogCompletion(products, records, { now = new Date().toISOString() } = {}) {
  const index = indexCatalog(products);
  const seen = new Set();
  const changes = new Map();

  const summary = {
    recordCount: records.length,
    updatedProducts: 0,
    alreadyComplete: 0,
    outsideCatalog: 0,
    ambiguousCodes: 0,
    repeatedInFile: 0,
    gainedByField: emptyCounts(),
    filledByField: emptyCounts(),
    invalidByField: emptyCounts(),
  };

  for (const record of records) {
    const code = record.candidate?.systemCode ?? '';
    const key = comparableCode(code);

    if (seen.has(key)) {
      summary.repeatedInFile += 1;
      continue;
    }

    seen.add(key);

    const { product, ambiguous } = findProduct(index, code);

    if (ambiguous) {
      summary.ambiguousCodes += 1;
      continue;
    }

    if (!product) {
      summary.outsideCatalog += 1;
      continue;
    }

    // Dois registros diferentes podem chegar ao mesmo produto — um pelo codigo
    // inteiro, outro pelo codigo sem zeros. O segundo enxerga o que o primeiro
    // ja preencheu, e nao preenche de novo.
    const current = changes.get(product.id) ?? product;
    const gained = {};

    for (const field of COMPLETABLE_FIELDS) {
      const read = readFileValue(record, field);

      if (read.absent) {
        continue;
      }

      if (!isEmpty(current[field])) {
        summary.filledByField[field] += 1;
        continue;
      }

      if (read.invalid) {
        summary.invalidByField[field] += 1;
        continue;
      }

      gained[field] = read.value;
      summary.gainedByField[field] += 1;
    }

    if (Object.keys(gained).length === 0) {
      summary.alreadyComplete += 1;
      continue;
    }

    changes.set(product.id, { ...current, ...gained, updatedAt: now });
  }

  summary.updatedProducts = changes.size;

  return { products: [...changes.values()], summary };
}
