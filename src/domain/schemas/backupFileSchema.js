import { z } from 'zod';

import { isoDateTimeField } from './commonFields.js';
import { ProductSchema } from './productSchema.js';

/**
 * Contrato do arquivo de backup.
 *
 * O arquivo e o retrato de um armazenamento local inteiro, e e lido num
 * dispositivo que nao gerou nenhum dos bytes dele. Por isso o contrato confere o
 * envelope antes do conteudo: um arquivo de outro programa, ou de uma versao
 * futura do formato, e recusado por uma frase so, em vez de produzir uma lista
 * de milhares de registros recusados que nao explica nada.
 *
 * Sao dois contratos sobre o mesmo arquivo, e a ordem entre eles importa:
 *
 * - `BackupEnvelopeSchema` confere a identidade do arquivo, as duas versoes, a
 *   data de geracao, a presenca das quatro tabelas e a coerencia das contagens.
 *   As tabelas sao vistas apenas como listas, sem olhar o que ha dentro.
 * - `BackupFileSchema` confere tudo isso e mais o conteudo: cada produto pelo
 *   `ProductSchema`, o mesmo contrato que o repositorio aplica na gravacao, e a
 *   unicidade dos identificadores dentro do proprio arquivo.
 *
 * O contrato do produto e reaproveitado inteiro, e nao copiado numa versao
 * relaxada. Uma copia relaxada so mudaria o lugar da recusa — de antes da
 * primeira escrita para o meio da gravacao —, que e exatamente o que a promessa
 * de recusar sem corromper nada nao pode admitir.
 *
 * As tres tabelas que nao sao a de produtos precisam vir **vazias**. Os dois
 * catalogos sao constante de codigo, e o trabalho de impressao e transiente e
 * nunca e gravado. Um arquivo que traga linha em qualquer uma das tres foi
 * montado fora deste contrato, e aceita-lo exigiria inventar forma para registro
 * que a aplicacao nao produz.
 */

/** Identidade do formato. Fica dentro do arquivo, e e a primeira coisa lida. */
export const BACKUP_FORMAT = 'labelforge-backup';

/** Versao do formato do arquivo. Muda quando o envelope muda de forma. */
export const BACKUP_FORMAT_VERSION = 1;

/** Versao do armazenamento local que este arquivo representa. */
export const BACKUP_DATABASE_VERSION = 1;

/** As quatro tabelas, na ordem em que aparecem no arquivo. */
export const BACKUP_TABLE_NAMES = Object.freeze([
  'products',
  'labelLayouts',
  'sheetLayouts',
  'printJobs',
]);

/** As tres que precisam vir vazias. */
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

const CountsSchema = z
  .object({
    products: countField('products'),
    labelLayouts: countField('labelLayouts'),
    sheetLayouts: countField('sheetLayouts'),
    printJobs: countField('printJobs'),
  })
  .strict(UNKNOWN_FIELD_MESSAGE);

const envelopeShape = {
  format: z.string({
    required_error: 'Arquivo sem a identificação do formato',
    invalid_type_error: 'A identificação do formato deve ser um texto',
  }),
  formatVersion: z
    .number({
      required_error: 'Arquivo sem a versão do formato',
      invalid_type_error: 'A versão do formato deve ser um número inteiro',
    })
    .int('A versão do formato deve ser um número inteiro'),
  databaseVersion: z
    .number({
      required_error: 'Arquivo sem a versão do armazenamento local',
      invalid_type_error: 'A versão do armazenamento local deve ser um número inteiro',
    })
    .int('A versão do armazenamento local deve ser um número inteiro'),
  generatedAt: isoDateTimeField('Data de geração do arquivo'),
  counts: CountsSchema,
};

function checkIdentity(file, ctx) {
  if (file.format !== BACKUP_FORMAT) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['format'],
      message: 'O arquivo não é um backup do LabelForge.',
    });
  }

  if (file.formatVersion !== BACKUP_FORMAT_VERSION) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['formatVersion'],
      message:
        `Versão de formato desconhecida: ${file.formatVersion}. ` +
        `Esta versão do aplicativo lê a versão ${BACKUP_FORMAT_VERSION}.`,
    });
  }

  if (file.databaseVersion !== BACKUP_DATABASE_VERSION) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['databaseVersion'],
      message:
        `O arquivo foi gerado com a versão ${file.databaseVersion} do armazenamento local, ` +
        `e este aplicativo usa a versão ${BACKUP_DATABASE_VERSION}.`,
    });
  }
}

// A contagem do envelope e uma soma independente do conteudo: quando as duas
// divergem, o arquivo foi cortado, concatenado ou editado a mao. E a conferencia
// mais barata que existe contra arquivo truncado.
function checkCounts(file, ctx) {
  BACKUP_TABLE_NAMES.forEach((name) => {
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

export const BackupEnvelopeSchema = z
  .object({
    ...envelopeShape,
    tables: z
      .object({
        products: tableList('products'),
        labelLayouts: tableList('labelLayouts'),
        sheetLayouts: tableList('sheetLayouts'),
        printJobs: tableList('printJobs'),
      })
      .strict(UNKNOWN_FIELD_MESSAGE),
  })
  .strict(UNKNOWN_FIELD_MESSAGE)
  .superRefine((file, ctx) => {
    checkIdentity(file, ctx);
    checkCounts(file, ctx);
  });

export const BackupFileSchema = z
  .object({
    ...envelopeShape,
    tables: z
      .object({
        products: z.array(ProductSchema, {
          required_error: `Tabela de ${describeBackupTable('products')} ausente no arquivo`,
          invalid_type_error: `Tabela de ${describeBackupTable('products')} deve ser uma lista`,
        }),
        labelLayouts: reservedTable('labelLayouts'),
        sheetLayouts: reservedTable('sheetLayouts'),
        printJobs: reservedTable('printJobs'),
      })
      .strict(UNKNOWN_FIELD_MESSAGE),
  })
  .strict(UNKNOWN_FIELD_MESSAGE)
  .superRefine((file, ctx) => {
    checkIdentity(file, ctx);
    checkCounts(file, ctx);
    checkDuplicateIds(file, ctx);
  });
