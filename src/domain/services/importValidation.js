import { buildNewProduct, validateProduct } from './productService.js';

/**
 * Recusa por conteudo do lote importado.
 *
 * Este e o unico ponto do importador em que um registro pode ser recusado, e
 * ele nao conhece nenhuma regra de produto: quem decide e `validateProduct`, o
 * mesmo caminho que o formulario usa. Nenhum limite, formato ou obrigatoriedade
 * e reescrito aqui — se o contrato mudar, o relatorio muda junto, sem edicao.
 *
 * Duas coisas justificam o modulo existir em vez de uma chamada solta:
 *
 * 1. **A sonda.** O contrato valida o produto inteiro, e identificador e datas
 *    so nascem na gravacao. Constantes validas ocupam o lugar deles para que a
 *    unica pergunta feita ao contrato seja sobre os campos que vieram do
 *    arquivo, e os tres sao retirados da resposta.
 * 2. **A fatia.** Conferir um lote grande de uma vez prende a thread principal
 *    pelo tempo inteiro. O lote e percorrido em fatias, com uma cessao de turno
 *    entre elas, do mesmo jeito que a leitura dos arquivos ja faz: o custo
 *    total e o mesmo, espalhado por varios quadros, e a tela continua
 *    respondendo e mostrando progresso.
 */

const PROBE_ID = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const PROBE_TIMESTAMP = '2000-01-01T00:00:00.000Z';

/**
 * Campos que a sonda preenche. Eles nunca falham com as constantes acima — o
 * teste da sonda guarda isso —, e por isso nao tem o que dizer ao usuario.
 */
const PROBE_FIELDS = ['id', 'createdAt', 'updatedAt'];

export const VALIDATION_SLICE_SIZE = 2000;

function yieldToInterface() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Confere um conjunto de campos de produto contra o contrato e devolve a
 * primeira mensagem de cada campo recusado, nas palavras do proprio contrato.
 */
export function validateCandidate(candidate) {
  const { success, fieldErrors } = validateProduct(
    buildNewProduct(candidate, { id: PROBE_ID, now: PROBE_TIMESTAMP }),
  );

  if (success) {
    return { success: true, fieldErrors: {} };
  }

  const visibleErrors = {};

  for (const [field, message] of Object.entries(fieldErrors)) {
    if (!PROBE_FIELDS.includes(field)) {
      visibleErrors[field] = message;
    }
  }

  return { success: false, fieldErrors: visibleErrors };
}

/**
 * Percorre o lote em fatias, entregando cada resultado assim que ele sai.
 *
 * Nada e acumulado aqui de proposito: uma lista paralela de centenas de
 * milhares de resultados so existiria para ser percorrida de novo. Quem chama
 * monta o que precisa dentro de `onRecord`, e `onProgress` recebe, ao fim de
 * cada fatia, quantos registros ja foram conferidos.
 *
 * `resolveCandidateFor` permite conferir o registro ja com a correcao do
 * usuario aplicada; sem ele, vale o candidato como veio do arquivo.
 */
export async function validateImportRecords(records, options = {}) {
  const {
    sliceSize = VALIDATION_SLICE_SIZE,
    resolveCandidateFor = (record) => record.candidate,
    onRecord,
    onProgress,
  } = options;

  const total = records.length;

  for (let start = 0; start < total; start += sliceSize) {
    const end = Math.min(start + sliceSize, total);

    for (let index = start; index < end; index += 1) {
      const record = records[index];

      onRecord?.(record, validateCandidate(resolveCandidateFor(record)), index);
    }

    onProgress?.(end, total);

    if (end < total) {
      await yieldToInterface();
    }
  }

  return total;
}
