// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import {
  BACKUP_DATABASE_VERSION,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
} from '../schemas/backupFileSchema.js';

import { MAX_REPORTED_ISSUES, describeIssueLocation, readBackupFile } from './backupRead.js';
import {
  describeBackupMoment,
  describeBackupOrigin,
  describeOmittedIssues,
  describeProductCount,
  describeRefusalHeadline,
  describeRefusalLine,
  describeRestoreImpact,
  describeRestoreResult,
  describeRestoreWarning,
} from './backupText.js';
import { restoreBackup } from './backupWriter.js';

/**
 * A leitura do arquivo, a gravacao e os textos que o operador le.
 *
 * A gravacao e exercitada contra um dublê de repositorio, como a gravacao do
 * lote ja e: o servico recebe o repositorio como dependencia, entao a sequencia
 * inteira roda num ambiente sem IndexedDB. O que fica sem cobertura automatizada
 * e o proprio IndexedDB, que continua sendo conferencia manual.
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

function texto(overrides) {
  return JSON.stringify(arquivo(overrides));
}

describe('arquivo que nem chega ao contrato', () => {
  it('recusa conteudo que nao e JSON', () => {
    const lido = readBackupFile('isto nao e um arquivo de backup');

    expect(lido.file).toBe(null);
    expect(lido.issues).toEqual([{ where: null, message: 'O arquivo não é um JSON válido.' }]);
  });

  it('recusa JSON que nao traz um envelope', () => {
    const lido = readBackupFile('[1, 2, 3]');

    expect(lido.file).toBe(null);
    expect(lido.issues[0].message).toBe('O arquivo não tem o envelope do backup.');
  });
});

describe('recusa pelo envelope', () => {
  it('para no envelope sem listar registro nenhum', () => {
    const lido = readBackupFile(
      texto({ envelope: { format: 'outro' }, produtos: [produto({ priceInCentavos: 'x' })] }),
    );

    expect(lido.file).toBe(null);
    expect(lido.issues).toHaveLength(1);
    expect(lido.issues[0].message).toBe('O arquivo não é um backup do LabelForge.');
  });

  it('aponta o campo do envelope onde o problema esta', () => {
    const lido = readBackupFile(texto({ envelope: { formatVersion: 9 } }));

    expect(lido.issues[0].where).toBe('Envelope, campo formatVersion');
  });

  it('recusa contagem que nao confere, dizendo onde', () => {
    const lido = readBackupFile(texto({ counts: { products: 4 } }));

    expect(lido.issues[0].where).toBe('Contagem de produtos');
  });
});

describe('recusa pelo conteudo', () => {
  it('lista todos os problemas encontrados, e nao so o primeiro', () => {
    const lido = readBackupFile(
      texto({
        produtos: [
          produto({ priceInCentavos: 'x' }),
          produto({ id: SEGUNDO_ID, priceInCentavos: 'y' }),
        ],
      }),
    );

    expect(lido.file).toBe(null);
    expect(lido.totalIssues).toBe(2);
    expect(lido.issues).toHaveLength(2);
  });

  it('diz qual produto e qual campo', () => {
    const lido = readBackupFile(texto({ produtos: [produto({ systemCode: 'código com espaço' })] }));

    expect(lido.issues[0].where).toBe('Produto 1, campo systemCode');
  });

  it('corta a lista no teto e conta o que sobrou', () => {
    const produtos = Array.from({ length: MAX_REPORTED_ISSUES + 3 }, (_, index) =>
      produto({
        id: `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`,
        priceInCentavos: 'x',
      }),
    );

    const lido = readBackupFile(texto({ produtos }));

    expect(lido.issues).toHaveLength(MAX_REPORTED_ISSUES);
    expect(lido.totalIssues).toBe(MAX_REPORTED_ISSUES + 3);
    expect(lido.omittedIssues).toBe(3);
  });

  it('reescreve em portugues a recusa de campo que nao pertence ao contrato', () => {
    const lido = readBackupFile(texto({ produtos: [{ ...produto(), fornecedor: 'Atacado' }] }));

    expect(lido.issues[0].message).toBe(
      'Campo que não pertence ao formato do backup: fornecedor',
    );
  });

  it('reescreve em portugues a recusa de campo ausente', () => {
    const semNome = produto();

    delete semNome.displayName;

    const lido = readBackupFile(texto({ produtos: [semNome] }));

    expect(lido.issues[0].message).toBe('Campo obrigatório ausente.');
  });

  it('recusa identificador repetido dentro do proprio arquivo', () => {
    const lido = readBackupFile(texto({ produtos: [produto(), produto()] }));

    expect(lido.file).toBe(null);
    expect(lido.issues[0].message).toContain('Identificador repetido dentro do próprio arquivo');
  });
});

describe('arquivo aceito', () => {
  it('devolve o arquivo conferido e nenhuma recusa', () => {
    const lido = readBackupFile(texto());

    expect(lido.issues).toEqual([]);
    expect(lido.totalIssues).toBe(0);
    expect(lido.file.tables.products).toHaveLength(1);
  });
});

describe('lugar do problema', () => {
  it('descreve a tabela pelo nome que o operador le', () => {
    expect(describeIssueLocation(['tables', 'labelLayouts'])).toBe('Tabela de modelos de etiqueta');
  });

  it('conta o produto a partir de um', () => {
    expect(describeIssueLocation(['tables', 'products', 0])).toBe('Produto 1');
  });

  it('nao inventa lugar quando o problema e do arquivo inteiro', () => {
    expect(describeIssueLocation([])).toBe(null);
  });
});

describe('gravacao', () => {
  it('troca o conteudo inteiro numa chamada so', async () => {
    const replaceAllProducts = vi.fn().mockResolvedValue(2);
    const conteudo = readBackupFile(
      texto({ produtos: [produto(), produto({ id: SEGUNDO_ID, systemCode: 'SOF-310' })] }),
    ).file;

    const resultado = await restoreBackup(conteudo, { repository: { replaceAllProducts } });

    expect(replaceAllProducts).toHaveBeenCalledTimes(1);
    expect(replaceAllProducts.mock.calls[0][0]).toHaveLength(2);
    expect(resultado).toEqual({ restoredProducts: 2 });
  });

  it('grava o catalogo vazio quando o arquivo nao traz produto nenhum', async () => {
    const replaceAllProducts = vi.fn().mockResolvedValue(0);
    const conteudo = readBackupFile(texto({ produtos: [] })).file;

    const resultado = await restoreBackup(conteudo, { repository: { replaceAllProducts } });

    expect(replaceAllProducts).toHaveBeenCalledWith([]);
    expect(resultado).toEqual({ restoredProducts: 0 });
  });

  it('deixa a falha do armazenamento subir como veio', async () => {
    const falha = new Error('QuotaExceededError');
    const replaceAllProducts = vi.fn().mockRejectedValue(falha);
    const conteudo = readBackupFile(texto()).file;

    await expect(restoreBackup(conteudo, { repository: { replaceAllProducts } })).rejects.toBe(
      falha,
    );
  });
});

describe('textos da confirmacao', () => {
  it('escreve o plural do produto', () => {
    expect(describeProductCount(1)).toBe('1 produto');
    expect(describeProductCount(12)).toBe('12 produtos');
  });

  it('mostra a data de geracao no fuso de quem le', () => {
    expect(describeBackupMoment(new Date(2026, 8, 18, 16, 7).toISOString())).toBe(
      '18/09/2026 às 16:07',
    );
  });

  it('avisa quando a data de geracao nao e legivel', () => {
    expect(describeBackupOrigin('data qualquer')).toBe('Arquivo sem data de geração legível.');
  });

  it('poe os dois numeros lado a lado', () => {
    expect(describeRestoreImpact(12, 3)).toBe(
      'O arquivo traz 12 produtos, e este dispositivo tem 3 produtos gravados agora.',
    );
  });

  it('nao alarma sobre catalogo vazio', () => {
    expect(describeRestoreImpact(12, 0)).toContain('não tem nenhum produto gravado');
    expect(describeRestoreWarning(0)).toBe(
      'O conteúdo do arquivo passa a ser o conteúdo deste dispositivo.',
    );
  });

  it('diz a consequencia sem eufemismo quando ha o que substituir', () => {
    expect(describeRestoreWarning(3)).toContain('inclusive os que não estiverem nele');
  });

  it('informa o resultado da restauracao', () => {
    expect(describeRestoreResult(3)).toBe('3 produtos restaurados a partir do arquivo.');
  });
});

describe('textos da recusa', () => {
  it('abre dizendo que nada foi alterado', () => {
    expect(describeRefusalHeadline(1)).toContain('nada foi alterado');
    expect(describeRefusalHeadline(1)).toContain('1 problema');
    expect(describeRefusalHeadline(4)).toContain('4 problemas');
  });

  it('escreve o lugar na frente do problema quando ele existe', () => {
    expect(describeRefusalLine({ where: 'Produto 2, campo ean', message: 'Inválido' })).toBe(
      'Produto 2, campo ean: Inválido',
    );
    expect(describeRefusalLine({ where: null, message: 'Inválido' })).toBe('Inválido');
  });

  it('conta o que ficou fora da lista', () => {
    expect(describeOmittedIssues(0)).toBe(null);
    expect(describeOmittedIssues(1)).toBe('E mais 1 problema não listado.');
    expect(describeOmittedIssues(5)).toBe('E mais 5 problemas não listados.');
  });
});
