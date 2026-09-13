/**
 * Traducao das falhas do armazenamento local para um texto que o usuario
 * consiga agir em cima.
 *
 * Duas familias de erro chegam ate aqui pelo mesmo `await`: a recusa do
 * contrato, quando o registro nao passa no `ProductSchema`, e a recusa do
 * proprio IndexedDB, que o Dexie repassa mantendo o nome que o navegador deu.
 * Nenhuma das duas pode ser exibida como esta — a mensagem do contrato e um
 * JSON inteiro, e a do banco vem em ingles.
 *
 * O nome do erro e o unico dado estavel entre navegadores; o texto que o
 * acompanha varia. E por ele que a mensagem e escolhida.
 */

const WRITE_FAILURE_MESSAGE =
  'Não foi possível gravar no armazenamento deste dispositivo. Tente de novo.';

const READ_FAILURE_MESSAGE = 'O armazenamento deste dispositivo não respondeu à leitura.';

const MESSAGE_BY_ERROR_NAME = new Map([
  [
    'QuotaExceededError',
    'O armazenamento deste dispositivo está cheio. Libere espaço no navegador e tente de novo.',
  ],
  [
    'DatabaseClosedError',
    'A conexão com o armazenamento deste dispositivo foi interrompida. Recarregue a página e tente de novo.',
  ],
  [
    'VersionError',
    'O armazenamento deste dispositivo foi aberto por outra versão da aplicação. Recarregue a página e tente de novo.',
  ],
  [
    'InvalidStateError',
    'Este navegador está bloqueando o armazenamento local. Verifique as permissões do site e tente de novo.',
  ],
  ['ConstraintError', 'Já existe um produto gravado com este identificador.'],
  ['AbortError', 'A gravação foi interrompida antes de terminar. Tente de novo.'],
  ['ZodError', 'O produto não passou na validação e não foi gravado.'],
]);

// O Dexie embrulha o erro original do navegador e guarda o de dentro em
// `inner`, entao os dois niveis sao consultados antes de cair no texto geral.
function lookupMessage(error) {
  if (!error) {
    return null;
  }

  return MESSAGE_BY_ERROR_NAME.get(error.name) ?? MESSAGE_BY_ERROR_NAME.get(error.inner?.name) ?? null;
}

/**
 * Mensagem para uma gravacao que falhou. O registro continua como estava antes
 * da tentativa, entao o texto sempre aponta para uma nova tentativa em vez de
 * avisar sobre perda de dados.
 */
export function describeStorageError(error) {
  return lookupMessage(error) ?? WRITE_FAILURE_MESSAGE;
}

/**
 * Mensagem para a leitura da tabela de produtos que falhou. Sem ela a tela
 * mostraria uma lista vazia, indistinguivel de um catalogo que ainda nao tem
 * nenhum produto cadastrado.
 */
export function describeStorageReadError(error) {
  return lookupMessage(error) ?? READ_FAILURE_MESSAGE;
}
