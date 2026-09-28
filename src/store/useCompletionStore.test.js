// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bytesOf,
  footer,
  priceHeader,
  priceRow,
  stockHeader,
  stockRow,
} from '../domain/services/txtReportFixtures.js';

/**
 * A sequencia da complementacao: ler, comparar, esperar a confirmacao e gravar.
 * O repositorio entra como duble; o que se prova aqui e que nada e gravado
 * antes da confirmacao, que a gravacao e uma chamada so e que a falha dela nao
 * deixa o estado pela metade.
 */

const repository = vi.hoisted(() => ({
  clearAllProducts: vi.fn(),
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listProducts: vi.fn(),
  updateProduct: vi.fn(),
  updateProducts: vi.fn(),
}));

vi.mock('../storage/productRepository.js', () => repository);

const { COMPLETION_STATUS, useCompletionStore } = await import('./useCompletionStore.js');
const { useProductStore } = await import('./useProductStore.js');

const BEFORE = '2026-09-01T12:00:00.000Z';

const WARDROBE = Object.freeze({
  id: '11111111-1111-4111-8111-111111111111',
  systemCode: '1620',
  displayName: 'GUARDA ROUPA INVENTADO',
  priceInCentavos: 129990,
  createdAt: BEFORE,
  updatedAt: BEFORE,
});

const SOFA = Object.freeze({
  id: '22222222-2222-4222-8222-222222222222',
  systemCode: '118114',
  displayName: 'SOFA INVENTADO',
  priceInCentavos: 249990,
  description: 'SOFA INVENTADO 3 LUGARES',
  category: '21-MOVEIS',
  createdAt: BEFORE,
  updatedAt: BEFORE,
});

const STOCK_REPORT = bytesOf([
  ...stockHeader(1),
  'Grupo: 21-MOVEIS',
  stockRow({ code: '001620', description: 'GUARDA ROUPA INVENTADO 6PTS' }),
  stockRow({ code: '118114', description: 'SOFA INVENTADO' }),
  stockRow({ code: '777777', description: 'CAMA INVENTADA' }),
  ...footer(3),
]);

function file(name, content) {
  return new File([content], name, { type: 'application/octet-stream' });
}

async function readStockReport() {
  await useCompletionStore.getState().readFiles([file('saldo.TXT', STOCK_REPORT)]);
}

beforeEach(() => {
  vi.clearAllMocks();
  useCompletionStore.getState().reset();
  useProductStore.setState({ products: [WARDROBE, SOFA], isLoading: false, loadError: null });
  repository.listProducts.mockResolvedValue([WARDROBE, SOFA]);
  repository.updateProducts.mockImplementation(async (products) => products);
});

describe('leitura e resumo', () => {
  it('mostra o que muda antes de gravar qualquer coisa', async () => {
    await readStockReport();

    const { status, plan, files } = useCompletionStore.getState();

    expect(status).toBe(COMPLETION_STATUS.READY);
    expect(files).toEqual([expect.objectContaining({ fileName: 'saldo.TXT', format: 'txt' })]);
    expect(plan.summary).toEqual(
      expect.objectContaining({
        recordCount: 3,
        updatedProducts: 1,
        alreadyComplete: 1,
        outsideCatalog: 1,
      }),
    );
    expect(plan.summary.gainedByField.category).toBe(1);
    expect(plan.summary.filledByField.category).toBe(1);
    expect(repository.updateProducts).not.toHaveBeenCalled();
  });

  it('le a recusa do arquivo na lista de arquivos, sem nada a gravar', async () => {
    await useCompletionStore.getState().readFiles([file('anotacoes.txt', 'nada de relatorio')]);

    const { files, plan } = useCompletionStore.getState();

    expect(files[0].error).toMatch(/^Relatório em texto não reconhecido/);
    expect(plan.summary.updatedProducts).toBe(0);
  });

  it('avisa quando o catalogo nao pode ser lido', async () => {
    repository.listProducts.mockRejectedValue(new Error('banco fechado'));

    await readStockReport();

    const { status, error, plan } = useCompletionStore.getState();

    expect(status).toBe(COMPLETION_STATUS.IDLE);
    expect(error).toBe('O armazenamento deste dispositivo não respondeu à leitura.');
    expect(plan).toBeNull();
  });
});

describe('confirmacao', () => {
  it('grava numa chamada so, sem criar produto, e rele o catalogo', async () => {
    await readStockReport();
    await useCompletionStore.getState().confirm();

    expect(repository.updateProducts).toHaveBeenCalledTimes(1);

    const [written] = repository.updateProducts.mock.calls[0];

    expect(written).toEqual([
      { ...WARDROBE, category: '21-MOVEIS', description: 'GUARDA ROUPA INVENTADO 6PTS', updatedAt: expect.any(String) },
    ]);
    expect(written[0].updatedAt).not.toBe(BEFORE);
    expect(repository.createProduct).not.toHaveBeenCalled();
    expect(repository.listProducts).toHaveBeenCalledTimes(3);
    expect(useCompletionStore.getState().status).toBe(COMPLETION_STATUS.DONE);
    expect(useCompletionStore.getState().result.updatedProducts).toBe(1);
  });

  it('refaz a comparacao sobre o catalogo do momento da gravacao', async () => {
    await readStockReport();

    repository.listProducts.mockResolvedValue([{ ...WARDROBE, category: 'JA GRAVADA', description: 'X' }, SOFA]);

    await useCompletionStore.getState().confirm();

    expect(repository.updateProducts).toHaveBeenCalledWith([]);
    expect(useCompletionStore.getState().result.updatedProducts).toBe(0);
  });

  it('mantem o resumo e o motivo quando a transacao falha, para tentar de novo', async () => {
    await readStockReport();

    repository.updateProducts.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AbortError' }));

    await useCompletionStore.getState().confirm();

    const { status, error, plan, result } = useCompletionStore.getState();

    expect(status).toBe(COMPLETION_STATUS.READY);
    expect(error).toBe('A gravação foi interrompida antes de terminar. Tente de novo.');
    expect(plan.summary.updatedProducts).toBe(1);
    expect(result).toBeNull();
    expect(useProductStore.getState().products).toEqual([WARDROBE, SOFA]);
  });

  it('nao grava sem ter lido um arquivo', async () => {
    await useCompletionStore.getState().confirm();

    expect(repository.updateProducts).not.toHaveBeenCalled();
  });
});

describe('arquivo da tabela de preco', () => {
  it('completa a descricao pelo codigo com zero a esquerda', async () => {
    repository.listProducts.mockResolvedValue([{ ...WARDROBE }]);

    await useCompletionStore.getState().readFiles([
      file(
        'tabela.txt',
        bytesOf([...priceHeader(1), priceRow({ code: '01620', description: 'GUARDA ROUPA 6PTS' }), ...footer(1)]),
      ),
    ]);

    expect(useCompletionStore.getState().plan.products[0].description).toBe('GUARDA ROUPA 6PTS');
  });
});
