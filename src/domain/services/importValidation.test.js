import { describe, expect, it } from 'vitest';

import { DESCRIPTION_MAX_LENGTH } from '../schemas/productSchema.js';

import { resolveCandidate } from './importCorrection.js';
import { createImportRecord } from './importRecord.js';
import { VALIDATION_SLICE_SIZE, validateCandidate, validateImportRecords } from './importValidation.js';

/**
 * Todo valor aqui e inventado. Nenhum registro deste arquivo vem de documento
 * real.
 */
const VALID_CANDIDATE = {
  systemCode: 'INV-1',
  displayName: 'Produto inventado',
  priceInCentavos: 1000,
};

function recordWith(candidate, index = 0) {
  return {
    ...createImportRecord({
      fileName: 'planilha-inventada.csv',
      fileIndex: 0,
      format: 'csv',
      index,
      raw: {},
    }),
    candidate,
    candidateIssues: [],
  };
}

describe('validateCandidate', () => {
  it('aceita o candidato completo, o que prova que a sonda de identificador e datas e valida', () => {
    expect(validateCandidate(VALID_CANDIDATE)).toEqual({ success: true, fieldErrors: {} });
  });

  it('nunca devolve erro de identificador nem de datas, que o usuario nao preenche', () => {
    const { fieldErrors } = validateCandidate({ systemCode: '', displayName: '' });

    expect(Object.keys(fieldErrors).sort()).toEqual([
      'displayName',
      'priceInCentavos',
      'systemCode',
    ]);
  });

  it('devolve a mensagem do proprio contrato, sem copia da regra', () => {
    const tooLong = 'a'.repeat(DESCRIPTION_MAX_LENGTH + 1);
    const { success, fieldErrors } = validateCandidate({ ...VALID_CANDIDATE, description: tooLong });

    expect(success).toBe(false);
    expect(fieldErrors.description).toBe(
      `Descrição deve ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres`,
    );
  });

  it('recusa o codigo do sistema fora do conjunto de caracteres aceito', () => {
    const { fieldErrors } = validateCandidate({ ...VALID_CANDIDATE, systemCode: 'INV/1' });

    expect(fieldErrors.systemCode).toBe('Código do sistema aceita apenas letras, números e hífen');
  });

  it('cobra o preco ausente em portugues', () => {
    const { systemCode, displayName } = VALID_CANDIDATE;
    const { fieldErrors } = validateCandidate({ systemCode, displayName });

    expect(fieldErrors.priceInCentavos).toBe('Informe um preço válido. Ex.: 12,50');
  });

  it('recusa chave alheia ao contrato sem apontar campo', () => {
    const { success, fieldErrors } = validateCandidate({ ...VALID_CANDIDATE, cProd: 'INV-1' });

    expect(success).toBe(false);
    expect(fieldErrors).toEqual({});
  });
});

describe('validateImportRecords', () => {
  it('confere cada registro do lote e devolve o total', async () => {
    const records = [
      recordWith(VALID_CANDIDATE, 0),
      recordWith({ ...VALID_CANDIDATE, systemCode: '' }, 1),
    ];

    const seen = [];
    const total = await validateImportRecords(records, {
      onRecord: (record, validation, index) => seen.push([record.recordId, validation.success, index]),
    });

    expect(total).toBe(2);
    expect(seen).toEqual([
      ['0:0', true, 0],
      ['0:1', false, 1],
    ]);
  });

  it('confere o candidato ja com a correcao do usuario aplicada', async () => {
    const record = recordWith({ ...VALID_CANDIDATE, displayName: '' });
    const corrections = { '0:0': { displayName: 'Nome inventado pelo usuario' } };

    const seen = [];

    await validateImportRecords([record], {
      resolveCandidateFor: (item) => resolveCandidate(item, corrections[item.recordId] ?? null),
      onRecord: (item, validation) => seen.push(validation.success),
    });

    expect(seen).toEqual([true]);
  });

  it(
    'confere centenas de milhares de registros em fatias, sem estourar pilha nem argumentos',
    async () => {
      const total = 200000;
      const records = Array.from({ length: total }, (_, index) =>
        recordWith({ ...VALID_CANDIDATE, systemCode: `INV-${index}` }, index),
      );

      let checked = 0;
      const progress = [];

      const returned = await validateImportRecords(records, {
        onRecord: () => {
          checked += 1;
        },
        onProgress: (count) => progress.push(count),
      });

      expect(returned).toBe(total);
      expect(checked).toBe(total);
      // Uma cessao de turno por fatia: o lote nao foi conferido de uma vez so.
      expect(progress).toHaveLength(total / VALIDATION_SLICE_SIZE);
      expect(progress[0]).toBe(VALIDATION_SLICE_SIZE);
      expect(progress.at(-1)).toBe(total);
    },
    120000,
  );

  it('aceita lote vazio', async () => {
    await expect(validateImportRecords([], { onRecord: () => {} })).resolves.toBe(0);
  });
});
