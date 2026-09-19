// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  BACKUP_DATABASE_VERSION,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BackupEnvelopeSchema,
  BackupFileSchema,
} from './backupFileSchema.js';

/**
 * O contrato do arquivo de backup, conferido pelos dois lados: o que ele precisa
 * aceitar sem reclamar, e cada motivo pelo qual ele recusa.
 *
 * Os produtos daqui sao inventados para o teste. Nenhum dado de arquivo real
 * entra em fixture.
 */

const PRIMEIRO_ID = '11111111-1111-4111-8111-111111111111';
const SEGUNDO_ID = '22222222-2222-4222-8222-222222222222';

function produto(overrides = {}) {
  return {
    id: PRIMEIRO_ID,
    systemCode: 'GEL-220',
    displayName: 'Geladeira frost free 375 L',
    priceInCentavos: 289900,
    createdAt: '2026-09-18T12:00:00.000Z',
    updatedAt: '2026-09-18T12:00:00.000Z',
    ...overrides,
  };
}

function arquivo(overrides = {}) {
  const produtos = overrides.produtos ?? [produto()];

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    databaseVersion: BACKUP_DATABASE_VERSION,
    generatedAt: '2026-09-18T12:30:00.000Z',
    counts: {
      products: produtos.length,
      labelLayouts: 0,
      sheetLayouts: 0,
      printJobs: 0,
      ...overrides.counts,
    },
    tables: {
      products: produtos,
      labelLayouts: [],
      sheetLayouts: [],
      printJobs: [],
      ...overrides.tables,
    },
    ...overrides.envelope,
  };
}

function mensagens(resultado) {
  return resultado.error.issues.map((issue) => issue.message);
}

describe('arquivo bem formado', () => {
  it('passa nas duas conferencias', () => {
    const conteudo = arquivo();

    expect(BackupEnvelopeSchema.safeParse(conteudo).success).toBe(true);
    expect(BackupFileSchema.safeParse(conteudo).success).toBe(true);
  });

  it('aceita catalogo vazio, com as quatro tabelas presentes', () => {
    const conteudo = arquivo({ produtos: [] });

    expect(BackupFileSchema.safeParse(conteudo).success).toBe(true);
  });

  it('devolve o produto ja conferido pelo contrato do produto', () => {
    const conteudo = arquivo({ produtos: [produto({ displayName: '  Geladeira frost free 375 L  ' })] });
    const resultado = BackupFileSchema.safeParse(conteudo);

    expect(resultado.data.tables.products[0].displayName).toBe('Geladeira frost free 375 L');
  });
});

describe('identidade e versao', () => {
  it('recusa arquivo de outro formato', () => {
    const resultado = BackupEnvelopeSchema.safeParse(
      arquivo({ envelope: { format: 'outro-programa' } }),
    );

    expect(resultado.success).toBe(false);
    expect(mensagens(resultado)).toContain('O arquivo não é um backup do LabelForge.');
  });

  it('recusa versao de formato desconhecida', () => {
    const resultado = BackupEnvelopeSchema.safeParse(arquivo({ envelope: { formatVersion: 2 } }));

    expect(resultado.success).toBe(false);
    expect(mensagens(resultado)[0]).toContain('Versão de formato desconhecida: 2');
  });

  it('recusa versao de banco diferente da local', () => {
    const resultado = BackupEnvelopeSchema.safeParse(arquivo({ envelope: { databaseVersion: 3 } }));

    expect(resultado.success).toBe(false);
    expect(mensagens(resultado)[0]).toContain('versão 3 do armazenamento local');
  });

  it('recusa data de geracao fora do padrao', () => {
    const resultado = BackupEnvelopeSchema.safeParse(
      arquivo({ envelope: { generatedAt: '18/09/2026' } }),
    );

    expect(resultado.success).toBe(false);
    expect(mensagens(resultado)).toContain('Data de geração do arquivo deve estar no formato ISO 8601');
  });

  it('recusa campo que nao pertence ao formato', () => {
    const resultado = BackupEnvelopeSchema.safeParse(arquivo({ envelope: { origem: 'planilha' } }));

    expect(resultado.success).toBe(false);
    expect(resultado.error.issues[0].code).toBe('unrecognized_keys');
  });
});

describe('presenca e contagem das tabelas', () => {
  it('recusa arquivo sem uma das quatro tabelas', () => {
    const conteudo = arquivo();

    delete conteudo.tables.sheetLayouts;

    const resultado = BackupEnvelopeSchema.safeParse(conteudo);

    expect(resultado.success).toBe(false);
    expect(mensagens(resultado)).toContain('Tabela de modelos de folha ausente no arquivo');
  });

  it('recusa contagem que nao confere com o conteudo', () => {
    const resultado = BackupEnvelopeSchema.safeParse(arquivo({ counts: { products: 7 } }));

    expect(resultado.success).toBe(false);
    expect(mensagens(resultado)[0]).toContain('declara 7 de produtos e o arquivo traz 1');
  });

  it('recusa linha nas tabelas que precisam vir vazias', () => {
    const resultado = BackupFileSchema.safeParse(
      arquivo({ counts: { printJobs: 1 }, tables: { printJobs: [{ id: 'x' }] } }),
    );

    expect(resultado.success).toBe(false);
    expect(mensagens(resultado)).toContain('A tabela de trabalhos de impressão deve vir vazia');
  });
});

describe('conteudo dos registros', () => {
  it('recusa produto fora do contrato, apontando o campo', () => {
    const resultado = BackupFileSchema.safeParse(
      arquivo({ produtos: [produto({ priceInCentavos: '2.899,00' })] }),
    );

    expect(resultado.success).toBe(false);
    expect(resultado.error.issues[0].path).toEqual([
      'tables',
      'products',
      0,
      'priceInCentavos',
    ]);
  });

  it('recusa identificador repetido dentro do proprio arquivo', () => {
    const resultado = BackupFileSchema.safeParse(
      arquivo({ produtos: [produto(), produto({ systemCode: 'FOG-045' })] }),
    );

    expect(resultado.success).toBe(false);
    expect(mensagens(resultado)[0]).toContain('Identificador repetido dentro do próprio arquivo');
  });

  it('aceita dois produtos com identificadores diferentes', () => {
    const resultado = BackupFileSchema.safeParse(
      arquivo({ produtos: [produto(), produto({ id: SEGUNDO_ID, systemCode: 'FOG-045' })] }),
    );

    expect(resultado.success).toBe(true);
  });

  it('nao olha o conteudo dos registros na conferencia do envelope', () => {
    const conteudo = arquivo({ produtos: [produto({ priceInCentavos: '2.899,00' })] });

    expect(BackupEnvelopeSchema.safeParse(conteudo).success).toBe(true);
    expect(BackupFileSchema.safeParse(conteudo).success).toBe(false);
  });
});
