// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import {
  BACKUP_DATABASE_VERSION,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
} from '../schemas/backupFileSchema.js';

import { buildBackupFile, serializeBackupFile } from './backupFile.js';
import { readBackupFile } from './backupRead.js';
import { restoreBackup } from './backupWriter.js';

/**
 * Os dois formatos do arquivo de backup lado a lado: o formato 2, que o
 * aplicativo escreve, so com a tabela de produtos, e o formato 1, com as quatro
 * tabelas, que todo backup gerado antes tem e que continua restaurando os
 * mesmos produtos.
 */

const GERADO = '2026-10-01T12:00:00.000Z';

const CATALOGO = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    systemCode: 'ROUP-6P',
    displayName: 'Guarda-roupa 6 portas',
    priceInCentavos: 129990,
    ncm: '94036000',
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    systemCode: 'MICRO-30',
    displayName: 'Micro-ondas 30 L',
    priceInCentavos: 64990,
    ean: '7890000000031',
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
  },
];

function formatoAtual(overrides = {}) {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    databaseVersion: BACKUP_DATABASE_VERSION,
    generatedAt: GERADO,
    counts: { products: CATALOGO.length },
    tables: { products: CATALOGO },
    ...overrides,
  };
}

function formatoAnterior(overrides = {}) {
  return {
    format: BACKUP_FORMAT,
    formatVersion: 1,
    databaseVersion: 1,
    generatedAt: GERADO,
    counts: { products: CATALOGO.length, labelLayouts: 0, sheetLayouts: 0, printJobs: 0 },
    tables: { products: CATALOGO, labelLayouts: [], sheetLayouts: [], printJobs: [] },
    ...overrides,
  };
}

function ler(conteudo) {
  return readBackupFile(JSON.stringify(conteudo));
}

describe('arquivo gerado agora', () => {
  it('sai no formato 2, com a versao do banco e so a tabela de produtos', () => {
    const arquivo = buildBackupFile({ products: CATALOGO }, new Date(GERADO));

    expect(arquivo).toEqual(formatoAtual());
    expect(BACKUP_FORMAT_VERSION).toBe(2);
    expect(BACKUP_DATABASE_VERSION).toBe(3);
  });

  it('restaura os mesmos produtos', async () => {
    const replaceAllProducts = vi.fn().mockResolvedValue(CATALOGO.length);
    const texto = serializeBackupFile(buildBackupFile({ products: CATALOGO }, new Date(GERADO)));
    const lido = readBackupFile(texto);

    expect(lido.issues).toEqual([]);

    await restoreBackup(lido.file, { repository: { replaceAllProducts } });

    expect(replaceAllProducts).toHaveBeenCalledWith(CATALOGO);
  });

  it('recusa as tabelas que so o formato 1 tinha', () => {
    const lido = ler(
      formatoAtual({
        counts: { products: CATALOGO.length, labelLayouts: 0 },
        tables: { products: CATALOGO, labelLayouts: [] },
      }),
    );

    expect(lido.file).toBe(null);
    expect(lido.issues.map((issue) => issue.message)).toContain(
      'Campo que não pertence ao formato do backup: labelLayouts',
    );
  });
});

describe('arquivo no formato 1', () => {
  it('continua aceito e restaura os mesmos produtos', async () => {
    const replaceAllProducts = vi.fn().mockResolvedValue(CATALOGO.length);
    const lido = ler(formatoAnterior());

    expect(lido.issues).toEqual([]);

    const resultado = await restoreBackup(lido.file, { repository: { replaceAllProducts } });

    expect(replaceAllProducts).toHaveBeenCalledWith(CATALOGO);
    expect(resultado).toEqual({ restoredProducts: 2 });
  });

  it('continua recusando linha numa tabela que precisa vir vazia, com a mesma frase', () => {
    const lido = ler(
      formatoAnterior({
        counts: { products: CATALOGO.length, labelLayouts: 1, sheetLayouts: 0, printJobs: 0 },
        tables: { products: CATALOGO, labelLayouts: [{ id: 'x' }], sheetLayouts: [], printJobs: [] },
      }),
    );

    expect(lido.file).toBe(null);
    expect(lido.issues).toContainEqual({
      where: 'Tabela de modelos de etiqueta',
      message: 'A tabela de modelos de etiqueta deve vir vazia',
    });
  });

  it('continua exigindo as quatro tabelas', () => {
    const conteudo = formatoAnterior();

    delete conteudo.tables.printJobs;

    expect(ler(conteudo).issues).toContainEqual({
      where: 'Tabela de trabalhos de impressão',
      message: 'Campo obrigatório ausente.',
    });
  });
});

describe('versoes', () => {
  it('aceita as versoes do banco anteriores a atual', () => {
    expect(ler(formatoAtual({ databaseVersion: 1 })).issues).toEqual([]);
    expect(ler(formatoAtual({ databaseVersion: 2 })).issues).toEqual([]);
    expect(ler(formatoAnterior({ databaseVersion: 2 })).issues).toEqual([]);
  });

  it('recusa a versao do banco mais nova que a deste aplicativo', () => {
    const lido = ler(formatoAtual({ databaseVersion: 4 }));

    expect(lido.issues).toEqual([
      {
        where: 'Envelope, campo databaseVersion',
        message:
          'O arquivo foi gerado com a versão 4 do armazenamento local, e este aplicativo usa a versão 3.',
      },
    ]);
  });

  it('recusa formato desconhecido por uma frase so, dizendo quais le', () => {
    const lido = ler(formatoAtual({ formatVersion: 3, tables: { products: CATALOGO, extra: [] } }));

    expect(lido.issues).toEqual([
      {
        where: 'Envelope, campo formatVersion',
        message: 'Versão de formato desconhecida: 3. Esta versão do aplicativo lê as versões 1 e 2.',
      },
    ]);
  });
});
