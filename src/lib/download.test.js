// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { downloadBlob } from './download.js';

/**
 * O documento e a fabrica de enderecos entram falsos: o que se prova e a
 * sequencia — criar o endereco, clicar, tirar a ancora e liberar o endereco —,
 * e nao a capacidade do navegador de salvar arquivo.
 */
function fakes() {
  const anchor = { click: vi.fn(), remove: vi.fn() };
  const appended = [];

  const documentRef = {
    createElement: vi.fn(() => anchor),
    body: { appendChild: vi.fn((node) => appended.push(node)) },
  };

  const urlRef = {
    createObjectURL: vi.fn(() => 'blob:etiquetas'),
    revokeObjectURL: vi.fn(),
  };

  return { anchor, appended, documentRef, urlRef };
}

describe('disparo do download', () => {
  it('clica numa ancora com o nome do arquivo e depois a remove', () => {
    const { anchor, appended, documentRef, urlRef } = fakes();

    downloadBlob({ size: 10 }, 'labelforge-etiquetas-2026-09-17-tag-grande.pdf', {
      documentRef,
      urlRef,
    });

    expect(documentRef.createElement).toHaveBeenCalledWith('a');
    expect(anchor.href).toBe('blob:etiquetas');
    expect(anchor.download).toBe('labelforge-etiquetas-2026-09-17-tag-grande.pdf');
    expect(appended).toEqual([anchor]);
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
  });

  it('libera o endereco temporario depois do clique', () => {
    const { documentRef, urlRef } = fakes();

    downloadBlob({ size: 10 }, 'etiquetas.pdf', { documentRef, urlRef });

    expect(urlRef.revokeObjectURL).toHaveBeenCalledWith('blob:etiquetas');
  });

  it('libera o endereco mesmo quando o clique falha', () => {
    const { anchor, documentRef, urlRef } = fakes();

    anchor.click.mockImplementation(() => {
      throw new Error('clique recusado');
    });

    expect(() => downloadBlob({ size: 10 }, 'etiquetas.pdf', { documentRef, urlRef })).toThrow(
      'clique recusado',
    );
    expect(urlRef.revokeObjectURL).toHaveBeenCalledWith('blob:etiquetas');
  });
});
