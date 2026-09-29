import { z } from 'zod';

import { isoDateTimeField } from './commonFields.js';
import { ProductSchema } from './productSchema.js';

/**
 * Contrato do arquivo de backup.
 *
 * O arquivo e o retrato de um armazenamento local inteiro, e e lido num
 * dispositivo que nao gerou nenhum dos bytes dele. Por isso o contrato confere a
 * identidade antes de tudo: um arquivo de outro programa, ou de uma versao
 * futura do formato, e recusado por uma frase so, em vez de produzir uma lista
 * de campos e registros recusados que nao explica nada.
 *
 * Sao dois contratos sobre o mesmo arquivo, e a ordem entre eles importa:
 *
 * - `BackupEnvelopeSchema` confere a identidade do arquivo, as duas versoes, a
 *   data de geracao, a presenca das tabelas e a coerencia das contagens. As
 *   tabelas sao vistas apenas como listas, sem olhar o que ha dentro.
 * - `BackupFileSchema` confere tudo isso e mais o conteudo: cada produto pelo
 *   `ProductSchema`, o mesmo contrato que o repositorio aplica na gravacao, e a
 *   unicidade dos identificadores dentro do proprio arquivo.
 *
 * O contrato do produto e reaproveitado inteiro, e nao copiado numa versao
 * relaxada. Uma copia relaxada so mudaria o lugar da recusa — de antes da
 * primeira escrita para o meio da gravacao —, que e exatamente o que a promessa
 * de recusar sem corromper nada nao pode admitir.
 *
 * ## Os dois formatos
 *
 * O formato 2, o que este aplicativo escreve, leva so a tabela de produtos. O
 * formato 1 levava tambem `labelLayouts`, `sheetLayouts` e `printJobs`, sempre
 * vazias, e continua aceito: todo backup gerado antes segue restaurando os
 * mesmos produtos. Nele as tres tabelas precisam vir **vazias**, como sempre
 * precisaram; um arquivo que traga linha em qualquer uma delas foi montado fora
 * do contrato, e aceita-lo exigiria inventar forma para registro que a
 * aplicacao nunca produziu.
 *
 * A versao do armazenamento local acompanha a versao do banco. O arquivo de
 * qualquer versao igual ou anterior a atual e aceito; o de uma versao mais nova
 * veio de um aplicativo mais novo que este, e e recusado.
 */

/** Identidade do formato. Fica dentro do arquivo, e e a primeira coisa lida. */
export const BACKUP_FORMAT = 'labelforge-backup';

/** Versao do formato que este aplicativo escreve. Muda quando o envelope muda de forma. */
export const BACKUP_FORMAT_VERSION = 2;

/** Versao do formato dos arquivos com as quatro tabelas. Continua aceita na leitura. */
export const LEGACY_BACKUP_FORMAT_VERSION = 1;

/** Versoes do formato que a leitura aceita. */
export const SUPPORTED_BACKUP_FORMAT_VERSIONS = Object.freeze([
  LEGACY_BACKUP_FORMAT_VERSION,
  BACKUP_FORMAT_VERSION,
]);

/** Versao do armazenamento local que este aplicativo usa, a mesma do banco. */
export const BACKUP_DATABASE_VERSION = 3;

/** As tabelas do formato atual, na ordem em que aparecem no arquivo. */
export const BACKUP_TABLE_NAMES = Object.freeze(['products']);

/** As quatro tabelas do formato 1, na ordem em que aparecem no arquivo. */
export const LEGACY_BACKUP_TABLE_NAMES = Object.freeze([
  'products',
  'labelLayouts',
  'sheetLayouts',
  'printJobs',
]);

/** As tres que, no formato 1, precisam vir vazias. */
export const RESERVED_TABLE_NAMES = Object.freeze([
  'labelLayouts',
  'sheetLayouts',
  'printJobs',
]);

const TABLE_LABELS = Object.freeze({
  products: 'produtos',
  labelLayouts: 'modelos de etiqueta',
  sheetLayouts: 'modelos de folha',
  printJobs: 'trabalhos de impressão',
});

/** Nome da tabela como o operador le, e nao como a tabela se chama no banco. */
export function describeBackupTable(name) {
  return TABLE_LABELS[name] ?? name;
}

const UNKNOWN_FIELD_MESSAGE = 'O arquivo tem um campo que não pertence ao formato do backup';

function countField(name) {
  const label = describeBackupTable(name);

  return z
    .number({
      required_error: `Contagem de ${label} ausente no envelope`,
      invalid_type_error: `Contagem de ${label} deve ser um número inteiro`,
    })
    .int(`Contagem de ${label} deve ser um número inteiro`)
    .min(0, `Contagem de ${label} não pode ser negativa`);
}

function tableList(name) {
  const label = describeBackupTable(name);

  return z.array(z.unknown(), {
    required_error: `Tabela de ${label} ausente no arquivo`,
    invalid_type_error: `Tabela de ${label} deve ser uma lista`,
  });
}

function reservedTable(name) {
  return tableList(name).max(0, `A tabela de ${describeBackupTable(name)} deve vir vazia`);
}

const productsTable = z.array(ProductSchema, {
  required_error: `Tabela de ${describeBackupTable('products')} ausente no arquivo`,
  invalid_type_error: `Tabela de ${describeBackupTable('products')} deve ser uma lista`,
});

function shapeOf(names, fieldOf) {
  return Object.fromEntries(names.map((name) => [name, fieldOf(name)]));
}

const formatField = z.string({
  required_error: 'Arquivo sem a identificação do formato',
  invalid_type_error: 'A identificação do formato deve ser um texto',
});

const formatVersionField = z
  .number({
    required_error: 'Arquivo sem a versão do formato',
    invalid_type_error: 'A versão do formato deve ser um número inteiro',
  })
  .int('A versão do formato deve ser um número inteiro');

function checkIdentity(file, ctx) {
  if (file.format !== BACKUP_FORMAT) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['format'],
      message: 'O arquivo não é um backup do LabelForge.',
    });
  }

  if (!SUPPORTED_BACKUP_FORMAT_VERSIONS.includes(file.formatVersion)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['formatVersion'],
      message:
        `Versão de formato desconhecida: ${file.formatVersion}. ` +
        `Esta versão do aplicativo lê as versões ${SUPPORTED_BACKUP_FORMAT_VERSIONS.join(' e ')}.`,
    });
  }
}

// So a identidade, com o resto do arquivo ainda sem olhar. E ela que decide qual
// dos dois formatos confere o que vem depois.
const IdentitySchema = z
  .object({ format: formatField, formatVersion: formatVersionField })
  .passthrough()
  .superRefine(checkIdentity);

function checkDatabaseVersion(file, ctx) {
  if (file.databaseVersion >= 1 && file.databaseVersion <= BACKUP_DATABASE_VERSION) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['databaseVersion'],
    message:
      `O arquivo foi gerado com a versão ${file.databaseVersion} do armazenamento local, ` +
      `e este aplicativo usa a versão ${BACKUP_DATABASE_VERSION}.`,
  });
}

// A contagem do envelope e uma soma independente do conteudo: quando as duas
// divergem, o arquivo foi cortado, concatenado ou editado a mao. E a conferencia
// mais barata que existe contra arquivo truncado.
function checkCounts(names, file, ctx) {
  names.forEach((name) => {
    const declared = file.counts[name];
    const actual = file.tables[name].length;

    if (declared === actual) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['counts', name],
      message:
        `O envelope declara ${declared} de ${describeBackupTable(name)} ` +
        `e o arquivo traz ${actual}.`,
    });
  });
}

// O identificador e a chave primaria da tabela: dois registros com o mesmo
// identificador nao cabem no armazenamento, e a gravacao falharia no meio.
function checkDuplicateIds(file, ctx) {
  const seen = new Set();

  file.tables.products.forEach((product, index) => {
    if (seen.has(product.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tables', 'products', index, 'id'],
        message: `Identificador repetido dentro do próprio arquivo: ${product.id}`,
      });
      return;
    }

    seen.add(product.id);
  });
}

function fileOf(names, tableOf, checks = []) {
  return z
    .object({
      format: formatField,
      formatVersion: formatVersionField,
      databaseVersion: z
        .number({
          required_error: 'Arquivo sem a versão do armazenamento local',
          invalid_type_error: 'A versão do armazenamento local deve ser um número inteiro',
        })
        .int('A versão do armazenamento local deve ser um número inteiro'),
      generatedAt: isoDateTimeField('Data de geração do arquivo'),
      counts: z.object(shapeOf(names, countField)).strict(UNKNOWN_FIELD_MESSAGE),
      tables: z.object(shapeOf(names, tableOf)).strict(UNKNOWN_FIELD_MESSAGE),
    })
    .strict(UNKNOWN_FIELD_MESSAGE)
    .superRefine((file, ctx) => {
      checkDatabaseVersion(file, ctx);
      checkCounts(names, file, ctx);
      checks.forEach((check) => check(file, ctx));
    });
}

function contentTable(name) {
  return name === 'products' ? productsTable : reservedTable(name);
}

const ENVELOPES = {
  [LEGACY_BACKUP_FORMAT_VERSION]: fileOf(LEGACY_BACKUP_TABLE_NAMES, tableList),
  [BACKUP_FORMAT_VERSION]: fileOf(BACKUP_TABLE_NAMES, tableList),
};

const FILES = {
  [LEGACY_BACKUP_FORMAT_VERSION]: fileOf(LEGACY_BACKUP_TABLE_NAMES, contentTable, [
    checkDuplicateIds,
  ]),
  [BACKUP_FORMAT_VERSION]: fileOf(BACKUP_TABLE_NAMES, contentTable, [checkDuplicateIds]),
};

// Confere a identidade e, so se ela passar, entrega o arquivo ao contrato do
// formato que ele declara. As recusas chegam como vieram, com o mesmo lugar e a
// mesma frase.
function byFormatVersion(schemas) {
  return z.any().transform((input, ctx) => {
    const identity = IdentitySchema.safeParse(input);
    const result = identity.success ? schemas[input.formatVersion].safeParse(input) : identity;

    if (result.success) {
      return result.data;
    }

    result.error.issues.forEach((issue) => ctx.addIssue(issue));

    return z.NEVER;
  });
}

export const BackupEnvelopeSchema = byFormatVersion(ENVELOPES);

export const BackupFileSchema = byFormatVersion(FILES);
