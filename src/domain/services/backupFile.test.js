// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  BACKUP_DATABASE_VERSION,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BackupFileSchema,
} from '../schemas/backupFileSchema.js';

import {
  LARGE_BACKUP_THRESHOLD,
  buildBackupFile,
  buildBackupFileName,
  countBackupProducts,
  isLargeBackup,
  serializeBackupFile,
} from './backupFile.js';
import { readBackupFile } from './backupRead.js';

/**
 * A montagem do arquivo, o nome com que ele e baixado e o ciclo completo.
 *
 * O ciclo completo — montar, escrever, ler de volta e conferir que o conteudo
 * sobreviveu — e testavel aqui porque as duas pontas sao funcao pura. O que fica
 * de fora e o IndexedDB nas duas extremidades, que e conferencia manual.
 */

const PRIMEIRO_ID = '11111111-1111-4111-8111-111111111111';
const SEGUNDO_ID = '22222222-2222-4222-8222-222222222222';
const TERCEIRO_ID = '33333333-3333-4333-8333-333333333333';

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

const CATALOGO = [
  produto(),
  produto({
    id: SEGUNDO_ID,
    systemCode: 'SOF-310',
    displayName: 'Sofá retrátil 3 lugares',
    priceInCentavos: 189900,
    ean: '7890000000017',
    ncm: '94016100',
  }),
  produto({
    id: TERCEIRO_ID,
    systemCode: 'FOG-045',
    displayName: 'Fogão 5 bocas inox',
    priceInCentavos: 154900,
    description: 'Acompanha kit de instalação',
    category: 'Eletrodomésticos',
  }),
];

describe('montagem do envelope', () => {
  it('carrega a identidade do formato e as duas versoes', () => {
    const arquivo = buildBackupFile({ products: CATALOGO }, new Date('2026-09-18T12:30:00.000Z'));

    expect(arquivo.format).toBe(BACKUP_FORMAT);
    expect(arquivo.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(arquivo.databaseVersion).toBe(BACKUP_DATABASE_VERSION);
  });

  it('guarda a data de geracao em ISO 8601', () => {
    const arquivo = buildBackupFile({ products: [] }, new Date('2026-09-18T12:30:00.000Z'));

    expect(arquivo.generatedAt).toBe('2026-09-18T12:30:00.000Z');
  });

  it('escreve as quatro tabelas mesmo quando tres estao vazias', () => {
    const arquivo = buildBackupFile({ products: CATALOGO }, new Date());

    expect(Object.keys(arquivo.tables)).toEqual([
      'products',
      'labelLayouts',
      'sheetLayouts',
      'printJobs',
    ]);
    expect(arquivo.tables.labelLayouts).toEqual([]);
    expect(arquivo.tables.sheetLayouts).toEqual([]);
    expect(arquivo.tables.printJobs).toEqual([]);
  });

  it('conta a partir do proprio conteudo, e nao de um numero recebido', () => {
    const arquivo = buildBackupFile({ products: CATALOGO }, new Date());

    expect(arquivo.counts).toEqual({
      products: 3,
      labelLayouts: 0,
      sheetLayouts: 0,
      printJobs: 0,
    });
  });

  it('monta um arquivo vazio quando nada foi lido', () => {
    const arquivo = buildBackupFile({}, new Date());

    expect(arquivo.counts.products).toBe(0);
    expect(arquivo.tables.products).toEqual([]);
  });
});

describe('nome do arquivo baixado', () => {
  it('leva o produto, a funcao e a data local de quem exportou', () => {
    expect(buildBackupFileName(new Date(2026, 8, 18, 16, 7))).toBe(
      'labelforge-backup-2026-09-18.json',
    );
  });

  it('preenche mes e dia com dois digitos', () => {
    expect(buildBackupFileName(new Date(2026, 0, 5, 9, 3))).toBe(
      'labelforge-backup-2026-01-05.json',
    );
  });
});

describe('tamanho', () => {
  it('conta os produtos do arquivo', () => {
    expect(countBackupProducts(buildBackupFile({ products: CATALOGO }, new Date()))).toBe(3);
  });

  it('nao avisa sobre tamanho num catalogo comum', () => {
    expect(isLargeBackup(3)).toBe(false);
  });

  it('avisa a partir do limiar', () => {
    expect(isLargeBackup(LARGE_BACKUP_THRESHOLD)).toBe(true);
  });
});

describe('ciclo completo', () => {
  it('gera um texto que o proprio contrato aceita', () => {
    const texto = serializeBackupFile(buildBackupFile({ products: CATALOGO }, new Date()));

    expect(BackupFileSchema.safeParse(JSON.parse(texto)).success).toBe(true);
  });

  it('devolve os produtos identicos depois de escrever e ler de volta', () => {
    const arquivo = buildBackupFile({ products: CATALOGO }, new Date('2026-09-18T12:30:00.000Z'));
    const lido = readBackupFile(serializeBackupFile(arquivo));

    expect(lido.issues).toEqual([]);
    expect(lido.file.tables.products).toEqual(CATALOGO);
  });

  it('preserva o NCM na ida e na volta', () => {
    const arquivo = buildBackupFile({ products: CATALOGO }, new Date('2026-09-18T12:30:00.000Z'));
    const lido = readBackupFile(serializeBackupFile(arquivo));

    expect(lido.file.tables.products[1].ncm).toBe('94016100');
  });

  it('continua aceitando o backup gravado antes de o produto ter NCM', () => {
    // Arquivo escrito a mao no formato de sempre, sem a chave `ncm` em produto
    // nenhum: e o arquivo que existe hoje no computador de quem ja usa.
    const antigo = JSON.stringify({
      format: BACKUP_FORMAT,
      formatVersion: 1,
      databaseVersion: 1,
      generatedAt: '2026-09-18T12:30:00.000Z',
      counts: { products: 1, labelLayouts: 0, sheetLayouts: 0, printJobs: 0 },
      tables: { products: [produto()], labelLayouts: [], sheetLayouts: [], printJobs: [] },
    });
    const lido = readBackupFile(antigo);

    expect(lido.issues).toEqual([]);
    expect(lido.file.tables.products[0]).not.toHaveProperty('ncm');
  });

  it('preserva o envelope inteiro na volta', () => {
    const arquivo = buildBackupFile({ products: CATALOGO }, new Date('2026-09-18T12:30:00.000Z'));
    const lido = readBackupFile(serializeBackupFile(arquivo));

    expect(lido.file.format).toBe(BACKUP_FORMAT);
    expect(lido.file.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(lido.file.databaseVersion).toBe(BACKUP_DATABASE_VERSION);
    expect(lido.file.generatedAt).toBe('2026-09-18T12:30:00.000Z');
    expect(lido.file.counts.products).toBe(3);
  });

  it('escreve um texto legivel, com uma chave por linha', () => {
    const texto = serializeBackupFile(buildBackupFile({ products: [produto()] }, new Date()));

    expect(texto).toContain('\n  "format": "labelforge-backup"');
  });
});
