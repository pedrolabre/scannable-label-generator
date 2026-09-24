// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { EMPTY_PRODUCT_FORM_VALUES, toFormValues, toProductFields } from './productFormValues.js';

const DIGITADO = {
  ...EMPTY_PRODUCT_FORM_VALUES,
  displayName: 'Cantinho café rubi',
  systemCode: '118789',
  price: '859,90',
};

describe('NCM no formulario', () => {
  it('guarda os oito digitos mesmo quando digitado com os pontos da nota', () => {
    expect(toProductFields({ ...DIGITADO, ncm: '9403.50.00' }).ncm).toBe('94035000');
    expect(toProductFields({ ...DIGITADO, ncm: ' 94035000 ' }).ncm).toBe('94035000');
  });

  it('deixa o campo de fora quando esta em branco', () => {
    expect(toProductFields(DIGITADO)).not.toHaveProperty('ncm');
  });

  it('abre o produto gravado com o NCM no campo', () => {
    expect(toFormValues({ ...DIGITADO, priceInCentavos: 85990, ncm: '94035000' }).ncm).toBe(
      '94035000',
    );
    expect(toFormValues(null).ncm).toBe('');
  });
});
