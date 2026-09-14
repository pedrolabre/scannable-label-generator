// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BARCODE_ERROR_CODES, BarcodeError } from '../../lib/barcodeError.js';
import { findLabelLayout } from '../../domain/services/labelLayoutCatalog.js';

import ProductLabel from './ProductLabel.jsx';

const generateSymbol = vi.hoisted(() => vi.fn());

vi.mock('../../lib/barcode.js', () => ({ generateSymbol }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LAYOUT = findLabelLayout('etiqueta-media');

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

function surface() {
  return container.querySelector('[data-label-surface]');
}

describe('etiqueta enquanto o simbolo carrega', () => {
  it('reserva a caixa do simbolo no tamanho exato, sem indicador', async () => {
    generateSymbol.mockReturnValue(new Promise(() => {}));

    await render(<ProductLabel product={PRODUCT} layout={LAYOUT} />);

    const placeholder = container.querySelector('[data-symbol-state="pending"]');

    expect(placeholder).not.toBeNull();
    expect(placeholder.style.width).toBe(`${LAYOUT.symbolSizeMm}mm`);
    expect(placeholder.style.height).toBe(`${LAYOUT.symbolSizeMm}mm`);
    expect(container.querySelector('[data-symbol-state="ready"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('nome, preco e codigo ja estao desenhados antes do simbolo chegar', async () => {
    generateSymbol.mockReturnValue(new Promise(() => {}));

    await render(<ProductLabel product={PRODUCT} layout={LAYOUT} />);

    expect(container.textContent).toContain('Guarda-roupa seis portas');
    expect(container.querySelector('[data-label-zone="price"]').textContent).toBe('R$ 1.899,90');
    expect(container.querySelector('[data-label-zone="code"]').textContent).toBe('MOV-00412');
  });

  it('a etiqueta nao muda de tamanho quando o simbolo chega', async () => {
    let resolveSymbol;
    generateSymbol.mockReturnValue(
      new Promise((resolve) => {
        resolveSymbol = resolve;
      }),
    );

    await render(<ProductLabel product={PRODUCT} layout={LAYOUT} />);

    const waiting = { width: surface().style.width, height: surface().style.height };

    await act(async () => {
      resolveSymbol(SYMBOL);
    });

    expect(container.querySelector('[data-symbol-state="ready"]')).not.toBeNull();
    expect(surface().style.width).toBe(waiting.width);
    expect(surface().style.height).toBe(waiting.height);
  });
});

describe('etiqueta quando o simbolo falha', () => {
  it('mantem nome, preco e codigo, e troca o simbolo por um marcador curto', async () => {
    generateSymbol.mockRejectedValue(
      new BarcodeError(
        BARCODE_ERROR_CODES.CODE_TOO_LONG,
        'O código do sistema tem 4000 caracteres e não cabe no símbolo, que comporta 2420.',
      ),
    );

    await render(<ProductLabel product={PRODUCT} layout={LAYOUT} />);

    expect(container.textContent).toContain('Guarda-roupa seis portas');
    expect(container.querySelector('[data-label-zone="price"]').textContent).toBe('R$ 1.899,90');
    expect(container.querySelector('[data-label-zone="code"]').textContent).toBe('MOV-00412');
    expect(container.textContent).toContain('Sem símbolo');
    expect(container.querySelector('[data-symbol-state="ready"]')).toBeNull();
    expect(container.querySelector('[data-symbol-state="pending"]')).toBeNull();
  });

  it('escreve o motivo fora da etiqueta, e nao dentro da caixa do simbolo', async () => {
    generateSymbol.mockRejectedValue(
      new BarcodeError(
        BARCODE_ERROR_CODES.UNSUPPORTED_CHARACTER,
        'O código do sistema aceita apenas letras, números e hífen.',
      ),
    );

    await render(<ProductLabel product={PRODUCT} layout={LAYOUT} />);

    const alert = container.querySelector('[role="alert"]');

    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('apenas letras, números e hífen');
    expect(surface().contains(alert)).toBe(false);
  });

  it('a etiqueta com falha ocupa o mesmo espaco da etiqueta com simbolo', async () => {
    generateSymbol.mockResolvedValue(SYMBOL);
    await render(<ProductLabel product={PRODUCT} layout={LAYOUT} />);
    const withSymbol = { width: surface().style.width, height: surface().style.height };

    generateSymbol.mockRejectedValue(new BarcodeError(BARCODE_ERROR_CODES.ENGINE_FAILURE, 'Falha.'));
    await render(<ProductLabel product={{ ...PRODUCT, systemCode: 'MOV-00999' }} layout={LAYOUT} />);

    expect(surface().style.width).toBe(withSymbol.width);
    expect(surface().style.height).toBe(withSymbol.height);
  });
});

describe('etiqueta com texto que estoura', () => {
  it('nao redimensiona com nome de comprimento maximo nem com preco de seis digitos', async () => {
    generateSymbol.mockResolvedValue(SYMBOL);

    await render(<ProductLabel product={PRODUCT} layout={LAYOUT} />);
    const normal = { width: surface().style.width, height: surface().style.height };

    await render(
      <ProductLabel
        product={{
          ...PRODUCT,
          displayName: 'A'.repeat(60),
          priceInCentavos: 12345678,
        }}
        layout={LAYOUT}
      />,
    );

    expect(surface().style.width).toBe(normal.width);
    expect(surface().style.height).toBe(normal.height);
    expect(surface().style.width).toBe(`${LAYOUT.widthMm}mm`);
    expect(surface().style.height).toBe(`${LAYOUT.heightMm}mm`);
  });

  it('o fator de ampliacao nao muda a medida fisica da etiqueta', async () => {
    generateSymbol.mockResolvedValue(SYMBOL);

    await render(<ProductLabel product={PRODUCT} layout={LAYOUT} scaleFactor={2} />);

    expect(surface().style.width).toBe(`${LAYOUT.widthMm}mm`);
    expect(surface().style.height).toBe(`${LAYOUT.heightMm}mm`);
    expect(surface().style.transform).toBe('scale(2)');
    expect(surface().parentElement.style.width).toBe(`${LAYOUT.widthMm * 2}mm`);
  });
});
