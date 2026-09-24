// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BACKUP_DATABASE_VERSION,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
} from '../../domain/schemas/backupFileSchema.js';

import BackupPanel from './BackupPanel.jsx';

/**
 * A tela do arquivo de backup: o que o operador ve ao exportar, ao escolher um
 * arquivo, ao confirmar e ao receber uma recusa.
 *
 * O armazenamento e o disparo do download entram como dublê. O que se prova
 * aqui e a tela — quais textos aparecem, o que o clique dispara e, sobretudo,
 * que um arquivo recusado nao chega a pedir gravacao nenhuma.
 */

const { readBackupTables, writeBackupTables } = vi.hoisted(() => ({
  readBackupTables: vi.fn(),
  writeBackupTables: vi.fn(),
}));

const { downloadBlob } = vi.hoisted(() => ({ downloadBlob: vi.fn() }));

vi.mock('../../storage/backupRepository.js', () => ({ readBackupTables, writeBackupTables }));
vi.mock('../../lib/download.js', () => ({ downloadBlob }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

function conteudoDeArquivo(produtos, overrides = {}) {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    databaseVersion: BACKUP_DATABASE_VERSION,
    generatedAt: new Date(2026, 8, 18, 16, 7).toISOString(),
    counts: {
      products: produtos.length,
      labelLayouts: 0,
      sheetLayouts: 0,
      printJobs: 0,
    },
    tables: { products: produtos, labelLayouts: [], sheetLayouts: [], printJobs: [] },
    ...overrides,
  });
}

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  readBackupTables.mockReset();
  writeBackupTables.mockReset();
  downloadBlob.mockReset();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  container = null;
  root = null;
});

function render(props = {}) {
  act(() => {
    root.render(<BackupPanel productCount={3} onRestored={undefined} {...props} />);
  });
}

function botao(rotulo) {
  return [...container.querySelectorAll('button')].find(
    (candidato) => candidato.textContent.trim() === rotulo,
  );
}

async function clicar(rotulo) {
  const alvo = botao(rotulo);

  await act(async () => {
    alvo.click();
  });
}

async function escolherArquivo(conteudo, nome = 'labelforge-backup-2026-09-18.json') {
  const campo = container.querySelector('#backup-file');
  const arquivo = new File([conteudo], nome, { type: 'application/json' });

  Object.defineProperty(campo, 'files', { value: [arquivo], configurable: true });

  await act(async () => {
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('cartao', () => {
  it('reune exportar e restaurar no mesmo lugar', () => {
    render();

    expect(container.textContent).toContain('Arquivo de backup');
    expect(container.textContent).toContain('Exportar');
    expect(container.textContent).toContain('Restaurar');
  });

  it('nao avisa sobre tamanho num catalogo comum', () => {
    render();

    expect(container.textContent).not.toContain('o arquivo gerado será grande');
  });

  it('avisa antes de gerar quando o catalogo e grande', () => {
    render({ productCount: 120000 });

    expect(container.textContent).toContain('o arquivo gerado será grande');
  });
});

describe('exportar', () => {
  it('le as tabelas e dispara o download com o nome do dia', async () => {
    readBackupTables.mockResolvedValue({
      products: [produto()],
      labelLayouts: [],
      sheetLayouts: [],
      printJobs: [],
    });

    render();
    await clicar('Exportar backup');

    expect(readBackupTables).toHaveBeenCalledTimes(1);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(downloadBlob.mock.calls[0][1]).toMatch(/^labelforge-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('avisa quando a leitura do armazenamento falha', async () => {
    readBackupTables.mockRejectedValue(new Error('DatabaseClosedError'));

    render();
    await clicar('Exportar backup');

    expect(container.textContent).toContain('Não foi possível gerar o arquivo de backup.');
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});

describe('arquivo recusado', () => {
  it('diz que nada foi alterado e nao pede gravacao nenhuma', async () => {
    render();
    await escolherArquivo('isto nao e um backup');

    expect(container.textContent).toContain('O arquivo foi recusado e nada foi alterado.');
    expect(container.textContent).toContain('O arquivo não é um JSON válido.');
    expect(writeBackupTables).not.toHaveBeenCalled();
  });

  it('nao abre a confirmacao quando o conteudo esta fora do contrato', async () => {
    render();
    await escolherArquivo(conteudoDeArquivo([produto({ priceInCentavos: '2.899,00' })]));

    expect(container.querySelector('[role="dialog"]')).toBe(null);
    expect(writeBackupTables).not.toHaveBeenCalled();
  });

  it('lista cada problema com o produto e o campo', async () => {
    render();
    await escolherArquivo(
      conteudoDeArquivo([produto(), produto({ id: SEGUNDO_ID, systemCode: 'com espaço' })]),
    );

    expect(container.textContent).toContain('Produto 2, campo systemCode');
  });
});

describe('confirmacao', () => {
  it('mostra a data de geracao, os dois numeros e o que acontece com os atuais', async () => {
    render({ productCount: 3 });
    await escolherArquivo(conteudoDeArquivo([produto(), produto({ id: SEGUNDO_ID })]));

    const dialogo = container.querySelector('[role="dialog"]');

    expect(dialogo.textContent).toContain('Arquivo gerado em 18/09/2026 às 16:07.');
    expect(dialogo.textContent).toContain(
      'O arquivo traz 2 produtos, e este dispositivo tem 3 produtos gravados agora.',
    );
    expect(dialogo.textContent).toContain(
      'Os produtos gravados neste dispositivo serão substituídos pelos do arquivo, inclusive os que não estiverem nele.',
    );
  });

  it('nomeia o arquivo escolhido', async () => {
    render();
    await escolherArquivo(conteudoDeArquivo([produto()]), 'copia-do-pen-drive.json');

    expect(container.querySelector('[role="dialog"]').textContent).toContain(
      'copia-do-pen-drive.json',
    );
  });

  it('cancelar fecha o dialogo sem gravar', async () => {
    render();
    await escolherArquivo(conteudoDeArquivo([produto()]));
    await clicar('Cancelar');

    expect(container.querySelector('[role="dialog"]')).toBe(null);
    expect(writeBackupTables).not.toHaveBeenCalled();
  });
});

describe('restauracao confirmada', () => {
  it('grava, avisa a tela e informa quantos voltaram', async () => {
    const onRestored = vi.fn().mockResolvedValue(undefined);

    writeBackupTables.mockResolvedValue(2);

    render({ productCount: 3, onRestored });
    await escolherArquivo(conteudoDeArquivo([produto(), produto({ id: SEGUNDO_ID })]));
    await clicar('Restaurar e substituir');

    expect(writeBackupTables).toHaveBeenCalledTimes(1);
    expect(writeBackupTables.mock.calls[0][0].products).toHaveLength(2);
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('2 produtos restaurados a partir do arquivo.');
    expect(container.querySelector('[role="dialog"]')).toBe(null);
  });

  it('mantem o dialogo aberto e oferece nova tentativa quando a gravacao falha', async () => {
    const falha = new Error('cheio');

    falha.name = 'QuotaExceededError';
    writeBackupTables.mockRejectedValue(falha);

    render();
    await escolherArquivo(conteudoDeArquivo([produto()]));
    await clicar('Restaurar e substituir');

    const dialogo = container.querySelector('[role="dialog"]');

    expect(dialogo).not.toBe(null);
    expect(dialogo.textContent).toContain('O armazenamento deste dispositivo está cheio.');
    expect(botao('Tentar de novo')).toBeTruthy();
  });
});
