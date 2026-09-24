import {
  BackupEnvelopeSchema,
  BackupFileSchema,
  describeBackupTable,
} from '../schemas/backupFileSchema.js';

/**
 * Leitura e conferencia do arquivo de backup.
 *
 * Nada aqui grava. A funcao devolve ou o arquivo inteiro conferido, ou a lista
 * do que ha de errado nele — e a gravacao so e chamada no primeiro caso. E essa
 * separacao que sustenta a promessa do bloco: um arquivo invalido e recusado sem
 * que uma unica linha do armazenamento tenha sido tocada.
 *
 * ## Por que o arquivo inteiro cai por um registro so
 *
 * Nao ha restauracao parcial. Restaurar e reconstruir um ambiente, e um ambiente
 * meio reconstruido nao se distingue, olhando a tela, de um ambiente inteiro: o
 * operador nao tem como saber o que faltou. Recusar o arquivo devolve a ele uma
 * decisao que ele consegue tomar — arrumar o arquivo, ou escolher outro.
 *
 * ## Por que duas passagens
 *
 * A primeira confere a identidade do arquivo, as versoes e as contagens; a
 * segunda confere o conteudo. Um arquivo de outro programa para na primeira, com
 * uma frase, em vez de virar uma lista de milhares de registros recusados que
 * nao diz o que realmente aconteceu.
 *
 * ## Por que todos os problemas, e nao so o primeiro
 *
 * A biblioteca de contrato ja devolve todas as recusas numa passada: listar uma
 * so seria jogar fora informacao ja calculada, e obrigaria o operador a corrigir
 * o arquivo uma linha por tentativa. O que ha e um teto no que se escreve na
 * tela, com o restante contado — como o relatorio da importacao em lote ja faz.
 */

/** Quantos problemas a tela mostra antes de passar a contar o resto. */
export const MAX_REPORTED_ISSUES = 10;

const TYPE_LABELS = Object.freeze({
  string: 'texto',
  number: 'número',
  boolean: 'booleano',
  object: 'objeto',
  array: 'lista',
  integer: 'número inteiro',
  null: 'nulo',
  undefined: 'nada',
  nan: 'número inválido',
});

function describeType(name) {
  return TYPE_LABELS[name] ?? name;
}

/**
 * Onde o problema esta, escrito para quem abre o arquivo num editor de texto.
 * O produto e contado a partir de um, porque e assim que ele aparece na tela e
 * no proprio arquivo indentado.
 */
export function describeIssueLocation(path) {
  if (!Array.isArray(path) || path.length === 0) {
    return null;
  }

  const [head, second, third, ...rest] = path;

  if (head === 'tables' && second === 'products' && typeof third === 'number') {
    const field = rest.length > 0 ? rest.join('.') : null;

    return field ? `Produto ${third + 1}, campo ${field}` : `Produto ${third + 1}`;
  }

  if (head === 'tables' && typeof second === 'string') {
    return `Tabela de ${describeBackupTable(second)}`;
  }

  if (head === 'counts' && typeof second === 'string') {
    return `Contagem de ${describeBackupTable(second)}`;
  }

  if (path.length === 1 && typeof head === 'string') {
    return `Envelope, campo ${head}`;
  }

  return path.join('.');
}

/**
 * Texto do problema.
 *
 * Quase toda recusa ja chega escrita em portugues, porque os contratos declaram
 * a propria mensagem. Duas nao chegam: a do campo com tipo inesperado e a do
 * campo que nao pertence ao contrato, cujas frases a biblioteca monta sozinha,
 * em ingles. Sao essas duas que esta funcao reescreve.
 */
export function describeIssue(issue) {
  if (issue.code === 'unrecognized_keys') {
    const keys = (issue.keys ?? []).join(', ');

    return `Campo que não pertence ao formato do backup: ${keys}`;
  }

  if (issue.code === 'invalid_type') {
    if (issue.received === 'undefined') {
      return 'Campo obrigatório ausente.';
    }

    return `Esperado ${describeType(issue.expected)} e veio ${describeType(issue.received)}.`;
  }

  return issue.message;
}

function toReport(issues) {
  const reported = [];

  for (const issue of issues) {
    if (reported.length >= MAX_REPORTED_ISSUES) {
      break;
    }

    reported.push({ where: describeIssueLocation(issue.path), message: describeIssue(issue) });
  }

  return {
    file: null,
    issues: reported,
    totalIssues: issues.length,
    omittedIssues: Math.max(issues.length - reported.length, 0),
  };
}

function refuse(message) {
  return {
    file: null,
    issues: [{ where: null, message }],
    totalIssues: 1,
    omittedIssues: 0,
  };
}

/**
 * Confere o texto do arquivo escolhido.
 *
 * Devolve sempre a mesma forma: `file` preenchido e `issues` vazio quando o
 * arquivo passa, e `file` nulo com a lista de problemas quando nao passa.
 */
export function readBackupFile(text) {
  let parsed = null;

  try {
    parsed = JSON.parse(text);
  } catch {
    return refuse('O arquivo não é um JSON válido.');
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return refuse('O arquivo não tem o envelope do backup.');
  }

  const envelope = BackupEnvelopeSchema.safeParse(parsed);

  if (!envelope.success) {
    return toReport(envelope.error.issues);
  }

  const file = BackupFileSchema.safeParse(parsed);

  if (!file.success) {
    return toReport(file.error.issues);
  }

  return { file: file.data, issues: [], totalIssues: 0, omittedIssues: 0 };
}
