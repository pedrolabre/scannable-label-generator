import { LARGE_BACKUP_THRESHOLD } from './backupFile.js';

/**
 * Textos do arquivo de backup: o que a confirmacao diz antes de substituir, o
 * que o resultado informa depois, e como uma recusa e apresentada.
 *
 * Moram fora do JSX pela regra de sempre: sao contas — plural, comparacao entre
 * dois numeros, corte da lista de problemas — e conta testavel nao vive dentro
 * de componente.
 */

function pad(value) {
  return String(value).padStart(2, '0');
}

/** Plural do produto, usado em toda frase que conta registro. */
export function describeProductCount(count) {
  return count === 1 ? '1 produto' : `${count} produtos`;
}

/**
 * Data e hora de geracao do arquivo, no fuso de quem esta lendo. E o unico dado
 * do envelope que responde "peguei o arquivo certo?", entao ele aparece na
 * confirmacao antes de qualquer numero.
 */
export function describeBackupMoment(isoText) {
  const moment = new Date(isoText);

  if (Number.isNaN(moment.getTime())) {
    return null;
  }

  const day = `${pad(moment.getDate())}/${pad(moment.getMonth() + 1)}/${moment.getFullYear()}`;

  return `${day} às ${pad(moment.getHours())}:${pad(moment.getMinutes())}`;
}

/** Linha de identificacao do arquivo escolhido, no topo da confirmacao. */
export function describeBackupOrigin(isoText) {
  const moment = describeBackupMoment(isoText);

  return moment ? `Arquivo gerado em ${moment}.` : 'Arquivo sem data de geração legível.';
}

/**
 * O que vai acontecer, com os dois numeros lado a lado. O catalogo vazio ganha
 * frase propria: dizer "os 0 produtos atuais serao substituidos" seria alarme
 * sobre coisa nenhuma.
 */
export function describeRestoreImpact(fileProductCount, currentProductCount) {
  const incoming = describeProductCount(fileProductCount);

  if (currentProductCount === 0) {
    return `O arquivo traz ${incoming}, e este dispositivo não tem nenhum produto gravado.`;
  }

  return (
    `O arquivo traz ${incoming}, e este dispositivo tem ${describeProductCount(currentProductCount)} ` +
    'gravados agora.'
  );
}

/** A consequencia, dita sem eufemismo, logo acima do botao que a executa. */
export function describeRestoreWarning(currentProductCount) {
  if (currentProductCount === 0) {
    return 'O conteúdo do arquivo passa a ser o conteúdo deste dispositivo.';
  }

  return (
    'Os produtos gravados neste dispositivo serão substituídos pelos do arquivo, ' +
    'inclusive os que não estiverem nele.'
  );
}

/** Resultado, no lugar em que o operador clicou. */
export function describeRestoreResult(restoredProducts) {
  return `${describeProductCount(restoredProducts)} restaurados a partir do arquivo.`;
}

/** Aviso de tamanho, antes de gerar o arquivo. */
export function describeLargeBackupWarning(productCount) {
  if (productCount < LARGE_BACKUP_THRESHOLD) {
    return null;
  }

  return (
    `O catálogo tem ${describeProductCount(productCount)}, e o arquivo gerado será grande. ` +
    'A página fica parada por alguns instantes enquanto ele é escrito.'
  );
}

/** Primeira linha da recusa, com o total de problemas encontrados. */
export function describeRefusalHeadline(totalIssues) {
  if (totalIssues === 1) {
    return 'O arquivo foi recusado e nada foi alterado. Foi encontrado 1 problema:';
  }

  return `O arquivo foi recusado e nada foi alterado. Foram encontrados ${totalIssues} problemas:`;
}

/** Uma linha por problema, com o lugar na frente quando ele existe. */
export function describeRefusalLine(issue) {
  return issue.where ? `${issue.where}: ${issue.message}` : issue.message;
}

/** Fecho da lista quando ela foi cortada. */
export function describeOmittedIssues(omittedIssues) {
  if (omittedIssues <= 0) {
    return null;
  }

  return omittedIssues === 1
    ? 'E mais 1 problema não listado.'
    : `E mais ${omittedIssues} problemas não listados.`;
}
