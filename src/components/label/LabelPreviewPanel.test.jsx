// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BARCODE_ERROR_CODES, BarcodeError } from '../../lib/barcodeError.js';
import { findLabelLayout } from '../../domain/services/labelLayoutCatalog.js';

import LabelPreviewPanel from './LabelPreviewPanel.jsx';

const generateSymbol = vi.hoisted(() => vi.fn());

vi.mock('../../lib/barcode.js', () => ({ generateSymbol }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PADRAO = findLabelLayout('tag-grande');
const MENOR = findLabelLayout('etiqueta-pequena');

const PRODUCT = {
  id: '6f0f3f3a-6f4f-4f4a-8f4a-6f4f4f4a8f4a',
  systemCode: 'MOV-00412',
  displayName: 'Guarda-roupa seis portas',
  priceInCentavos: 189990,
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
};

const SYMBOL = Object.freeze({
  systemCode: PRODUCT.systemCode,
  symbology: 'qrcode',
  errorCorrectionLevel: 'Q',
  moduleCount: 21,
  quietZoneModules: 4,
  totalModules: 29,
  svg: '<svg viewBox="0 0 58 58" preserveAspectRatio="xMidYMid meet"><rect width="58" height="58" fill="#FFFFFF"/></svg>',
});

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  generateSymbol.mockReset();
});

async function render(element) {
  await act(async () => {
    root.render(element);
  });
}

async function choose(name, value) {
  const option = container.querySelector(`input[name="${name}"][value="${value}"]`);

  await act(async () => {
    option.click();
  });
}

function surface() {
  return container.querySelector('[data-label-surface]');
}

describe('previa sem produto escolhido', () => {
  it('convida a escolher um produto e nao desenha etiqueta nenhuma', async () => {
    await render(<LabelPreviewPanel product={null} hasProducts />);

    const placeholder = container.querySelector('[data-preview-state="no-selection"]');

    expect(placeholder).not.toBeNull();
    expect(placeholder.textContent).toContain('Escolha um produto na listagem');
    expect(surface()).toBeNull();
    expect(generateSymbol).not.toHaveBeenCalled();
  });

  it('mantem o seletor de modelo utilizavel antes da escolha', async () => {
    await render(<LabelPreviewPanel product={null} hasProducts />);

    expect(container.querySelectorAll('input[name="modelo-etiqueta"]')).toHaveLength(3);
    expect(
      container.querySelector(`input[name="modelo-etiqueta"][value="${PADRAO.id}"]`).checked,
    ).toBe(true);
  });

  it('com o catalogo vazio aponta o formulario e esconde os seletores', async () => {
    await render(<LabelPreviewPanel product={null} hasProducts={false} />);

    const placeholder = container.querySelector('[data-preview-state="empty-catalog"]');

    expect(placeholder).not.toBeNull();
    expect(placeholder.textContent).toContain('Cadastre um produto');
    expect(container.querySelector('input[name="modelo-etiqueta"]')).toBeNull();
    expect(container.querySelector('input[name="ampliacao-etiqueta"]')).toBeNull();
    expect(surface()).toBeNull();
  });
});

describe('troca de modelo', () => {
  it('redesenha a etiqueta com as medidas do novo modelo, sem recarregar a pagina', async () => {
    generateSymbol.mockResolvedValue(SYMBOL);

    await render(<LabelPreviewPanel product={PRODUCT} hasProducts />);

    expect(surface().style.width).toBe(`${PADRAO.widthMm}mm`);
    expect(surface().style.height).toBe(`${PADRAO.heightMm}mm`);
    expect(container.querySelector('[data-symbol-state="ready"]').style.width).toBe(
      `${PADRAO.symbolSizeMm}mm`,
    );

    await choose('modelo-etiqueta', MENOR.id);

    expect(surface().style.width).toBe(`${MENOR.widthMm}mm`);
    expect(surface().style.height).toBe(`${MENOR.heightMm}mm`);
    expect(surface().dataset.labelWidthMm).toBe(String(MENOR.widthMm));
    expect(container.querySelector('[data-symbol-state="ready"]').style.width).toBe(
      `${MENOR.symbolSizeMm}mm`,
    );
  });

  it('nao gera o simbolo de novo ao trocar de modelo, porque o codigo nao mudou', async () => {
    generateSymbol.mockResolvedValue(SYMBOL);

    await render(<LabelPreviewPanel product={PRODUCT} hasProducts />);
    await choose('modelo-etiqueta', MENOR.id);

    expect(generateSymbol).toHaveBeenCalledTimes(1);
    expect(generateSymbol).toHaveBeenCalledWith(PRODUCT.systemCode);
  });
});

describe('ampliacao', () => {
  it('amplia o desenho sem mexer na medida fisica da etiqueta', async () => {
    generateSymbol.mockResolvedValue(SYMBOL);

    await render(<LabelPreviewPanel product={PRODUCT} hasProducts />);

    expect(surface().style.transform).toBe('scale(1)');

    await choose('ampliacao-etiqueta', '2');

    expect(surface().style.transform).toBe('scale(2)');
    expect(surface().style.width).toBe(`${PADRAO.widthMm}mm`);
    expect(surface().parentElement.style.width).toBe(`${PADRAO.widthMm * 2}mm`);
  });
});

describe('produto com simbolo recusado', () => {
  it('abre a previa assim mesmo, com a etiqueta desenhada e o motivo escrito', async () => {
    generateSymbol.mockRejectedValue(
      new BarcodeError(
        BARCODE_ERROR_CODES.CODE_TOO_LONG,
        'O código do sistema tem 4000 caracteres e não cabe no símbolo, que comporta 2420.',
      ),
    );

    await render(<LabelPreviewPanel product={PRODUCT} hasProducts />);

    expect(surface()).not.toBeNull();
    expect(container.querySelector('[data-preview-state="product"]')).not.toBeNull();
    expect(container.textContent).toContain('Guarda-roupa seis portas');
    expect(container.querySelector('[data-label-zone="price"]').textContent).toBe('R$ 1.899,90');
    expect(container.querySelector('[data-label-zone="code"]').textContent).toBe('MOV-00412');
    expect(container.textContent).toContain('Sem símbolo');

    const alerta = container.querySelector('[role="alert"]');

    expect(alerta).not.toBeNull();
    expect(alerta.textContent).toContain('não cabe no símbolo');
    expect(surface().contains(alerta)).toBe(false);
  });

  it('continua deixando trocar de modelo com o simbolo recusado', async () => {
    generateSymbol.mockRejectedValue(
      new BarcodeError(BARCODE_ERROR_CODES.ENGINE_FAILURE, 'Falha inesperada.'),
    );

    await render(<LabelPreviewPanel product={PRODUCT} hasProducts />);
    await choose('modelo-etiqueta', MENOR.id);

    expect(surface().style.width).toBe(`${MENOR.widthMm}mm`);
    expect(container.textContent).toContain('Sem símbolo');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
