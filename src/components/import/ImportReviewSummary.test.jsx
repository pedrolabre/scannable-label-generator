// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import ImportReviewSummary from './ImportReviewSummary.jsx';

/**
 * O resumo da revisao com o retorno da base de referencia: a frase dos
 * completados por campo e dos codigos fora da base, a ausencia dela quando
 * nada foi completado e o aviso da leitura da base que falhou.
 */

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const REPORT = { readyCount: 5462, attentionCount: 0, pendingCount: 0, refusedCount: 0 };

function summary(overrides = {}) {
  return {
    recordCount: 5462,
    lookedUp: 5462,
    found: 5462,
    notFound: 0,
    enriched: 5462,
    gainedByField: { ncm: 5462, ean: 1105 },
    replacedInvalidByField: { ncm: 0, ean: 0 },
    ...overrides,
  };
}

let container;
let root;

function render(props) {
  act(() => {
    root.render(<ImportReviewSummary report={REPORT} {...props} />);
  });
}

function enrichmentText() {
  return container.querySelector('[data-resumo-enriquecimento]')?.textContent ?? null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('frase do enriquecimento', () => {
  it('diz quantos registros ganharam NCM e codigo de barras pela base', () => {
    render({ enrichment: summary() });

    expect(enrichmentText()).toBe(
      'Completados pela base de referência: 5.462 com NCM e 1.105 com código de barras.',
    );
  });

  it('conta os registros com codigo fora da base', () => {
    render({
      enrichment: summary({
        recordCount: 18910,
        lookedUp: 18910,
        found: 18909,
        notFound: 1,
        enriched: 18909,
        gainedByField: { ncm: 18908, ean: 2579 },
      }),
    });

    expect(enrichmentText()).toBe(
      'Completados pela base de referência: 18.908 com NCM e 2.579 com código de barras. 1 registro com código fora da base.',
    );
  });

  it('deixa fora o campo que nenhum registro ganhou', () => {
    render({ enrichment: summary({ enriched: 2, gainedByField: { ncm: 0, ean: 2 }, notFound: 3 }) });

    expect(enrichmentText()).toBe(
      'Completados pela base de referência: 2 com código de barras. 3 registros com código fora da base.',
    );
  });

  it('nao aparece quando nada foi completado, nem com a base vazia', () => {
    render({
      enrichment: summary({ found: 0, notFound: 5462, enriched: 0, gainedByField: { ncm: 0, ean: 0 } }),
    });

    expect(enrichmentText()).toBeNull();

    render({ enrichment: null });

    expect(enrichmentText()).toBeNull();
    expect(container.querySelector('[data-falha-base]')).toBeNull();
  });
});

describe('falha de leitura da base', () => {
  it('avisa que a base nao foi consultada e que a gravacao continua disponivel', () => {
    render({
      enrichment: null,
      referenceError: 'O armazenamento deste dispositivo não respondeu à leitura.',
    });

    const notice = container.querySelector('[data-falha-base]');

    expect(notice.textContent).toContain('O armazenamento deste dispositivo não respondeu à leitura.');
    expect(notice.textContent).toContain('a gravação continua disponível');
    expect(notice.getAttribute('role')).toBeNull();
    expect(enrichmentText()).toBeNull();
  });
});
