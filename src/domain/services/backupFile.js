import {
  BACKUP_DATABASE_VERSION,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_TABLE_NAMES,
} from '../schemas/backupFileSchema.js';

/**
 * Montagem do arquivo de backup e o nome com que ele e baixado.
 *
 * Funcoes puras, sem DOM, sem React e sem armazenamento: quem le as tabelas e a
 * camada de persistencia, quem dispara o download e a tela, e aqui fica apenas a
 * forma do arquivo.
 *
 * ## Por que as quatro tabelas, mesmo vazias
 *
 * As tres tabelas que nao sao a de produtos saem como lista vazia em vez de
 * ficarem de fora. Custa nada e resolve uma ambiguidade real: sem elas, quem le
 * o arquivo nao distingue "a tabela estava vazia" de "o arquivo foi cortado".
 * Com elas, a forma do envelope nao depende do conteudo do armazenamento, e a
 * conferencia de presenca de tabela passa a significar alguma coisa.
 *
 * ## Por que JSON puro
 *
 * O arquivo e a ultima copia dos dados de quem o gerou, e precisa continuar
 * legivel sem a aplicacao: aberto num editor de texto, o envelope se explica
 * sozinho. Comprimir exigiria ou uma biblioteca a mais, ou a interface de
 * compressao do navegador, que nao existe fora dele e tiraria o ciclo inteiro do
 * alcance da suite.
 *
 * ## Tamanho
 *
 * Nao ha teto. Um backup que se recusa a rodar deixa quem tem catalogo grande
 * sem nenhuma forma de tirar os dados do dispositivo, que e o oposto do que o
 * arquivo existe para fazer. O que ha e um aviso: acima do limiar, a tela diz
 * antes que o arquivo sera grande e que a pagina trava por um instante enquanto
 * ele e escrito.
 */

const FILE_NAME_PREFIX = 'labelforge-backup';

/**
 * A partir daqui a tela avisa sobre o tamanho antes de gerar. O numero vem do
 * custo conhecido: cerca de trezentos bytes por produto, e a escrita do texto e
 * uma chamada unica que nao cede o turno enquanto corre.
 */
export const LARGE_BACKUP_THRESHOLD = 50000;

/**
 * Monta o envelope a partir das quatro tabelas ja lidas.
 *
 * As contagens saem do proprio conteudo, e nao de um parametro: uma contagem
 * informada de fora poderia divergir do que o arquivo carrega, e e justamente
 * essa divergencia que a leitura usa para detectar arquivo truncado.
 */
export function buildBackupFile(tables, generatedAt) {
  const content = {};

  BACKUP_TABLE_NAMES.forEach((name) => {
    content[name] = tables?.[name] ?? [];
  });

  const counts = {};

  BACKUP_TABLE_NAMES.forEach((name) => {
    counts[name] = content[name].length;
  });

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    databaseVersion: BACKUP_DATABASE_VERSION,
    generatedAt: generatedAt.toISOString(),
    counts,
    tables: content,
  };
}

/**
 * Texto do arquivo. Indentado de proposito: o arquivo e conferido a olho num
 * editor de texto, e a indentacao custa poucos por cento do tamanho final.
 */
export function serializeBackupFile(file) {
  return JSON.stringify(file, null, 2);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * Nome do arquivo baixado: produto, funcao e data local de quem exportou. Segue
 * a mesma convencao que a exportacao do PDF ja fixou — sem hora, que so serviria
 * para distinguir dois arquivos gerados no mesmo dia.
 */
export function buildBackupFileName(date) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  return `${FILE_NAME_PREFIX}-${day}.json`;
}

/** Quantos produtos o arquivo carrega, para a tela e para a confirmacao. */
export function countBackupProducts(file) {
  return file?.tables?.products?.length ?? 0;
}

/** Verdadeiro quando vale avisar sobre o tamanho antes de gerar o arquivo. */
export function isLargeBackup(productCount) {
  return productCount >= LARGE_BACKUP_THRESHOLD;
}
