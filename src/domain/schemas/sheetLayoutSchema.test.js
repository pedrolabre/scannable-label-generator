// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { buildSheetLayout } from '../services/printJobBuilder.js';
import { findSheetLayout } from '../services/sheetLayoutCatalog.js';

import { SheetLayoutSchema } from './sheetLayoutSchema.js';

/**
 * As duas recusas cruzadas do contrato da folha: margens que consomem a largura
 * inteira e margens que consomem a altura inteira. Nenhuma das duas e alcancavel
 * pela tela, porque o campo de margem tem teto de 50 mm e a menor folha do
 * catalogo tem 210 mm no lado mais curto. Elas existem porque o contrato e o
 * unico caminho de leitura e escrita de uma folha, e uma folha vinda de outro
 * lugar — um arquivo restaurado, um catalogo futuro — nao passa pela tela.
 *
 * Conferi-las aqui e o que impede que a regra seja removida por engano junto com
 * o campo que ela protege.
 */

const RETRATO = findSheetLayout('a4-retrato');
const PAISAGEM = findSheetLayout('a4-paisagem');

/** Teto de margem do formulario da tela, em milimetro. */
const MAX_MARGIN_MM = 50;

function refusalOf(sheet) {
  const parsed = SheetLayoutSchema.safeParse(sheet);

  return parsed.success ? null : parsed.error.issues;
}

describe('margens laterais contra a largura da folha', () => {
  it('recusa quando as duas somam mais que a largura', () => {
    const issues = refusalOf({ ...RETRATO, marginLeftMm: 120, marginRightMm: 100 });

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual(['marginLeftMm']);
    expect(issues[0].message).toBe('Margens laterais ocupam toda a largura da folha');
  });

  it('recusa tambem o encaixe exato, que nao deixa area util nenhuma', () => {
    // 105 + 105 = 210, a largura inteira do retrato.
    const issues = refusalOf({ ...RETRATO, marginLeftMm: 105, marginRightMm: 105 });

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual(['marginLeftMm']);
  });

  it('aceita um milimetro a menos que a largura', () => {
    expect(refusalOf({ ...RETRATO, marginLeftMm: 105, marginRightMm: 104 })).toBeNull();
  });
});

describe('margens verticais contra a altura da folha', () => {
  it('recusa quando as duas somam mais que a altura', () => {
    const issues = refusalOf({ ...PAISAGEM, marginTopMm: 120, marginBottomMm: 100 });

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual(['marginTopMm']);
    expect(issues[0].message).toBe('Margens verticais ocupam toda a altura da folha');
  });

  it('recusa o encaixe exato, e aceita um milimetro a menos', () => {
    // A paisagem tem 210 mm de altura.
    expect(refusalOf({ ...PAISAGEM, marginTopMm: 105, marginBottomMm: 105 })).toHaveLength(1);
    expect(refusalOf({ ...PAISAGEM, marginTopMm: 105, marginBottomMm: 104 })).toBeNull();
  });

  it('cobra as duas recusas ao mesmo tempo quando os dois eixos estouram', () => {
    const issues = refusalOf({
      ...RETRATO,
      marginLeftMm: 120,
      marginRightMm: 100,
      marginTopMm: 200,
      marginBottomMm: 120,
    });

    expect(issues.map((issue) => issue.path[0]).sort()).toEqual(['marginLeftMm', 'marginTopMm']);
  });
});

describe('alcance da tela', () => {
  it('nao alcanca nenhuma das duas recusas com o teto de margem do formulario', () => {
    // Quatro margens no teto: 100 mm somados por eixo, contra 210 mm no lado
    // mais curto das duas folhas do catalogo.
    ['a4-retrato', 'a4-paisagem'].forEach((sheetLayoutId) => {
      const { sheet, errors } = buildSheetLayout(sheetLayoutId, {
        marginTopMm: MAX_MARGIN_MM,
        marginRightMm: MAX_MARGIN_MM,
        marginBottomMm: MAX_MARGIN_MM,
        marginLeftMm: MAX_MARGIN_MM,
      });

      expect(errors.general).toEqual([]);
      expect(errors.fields).toEqual({});
      expect(sheet).not.toBeNull();
      expect(sheet.widthMm - sheet.marginLeftMm - sheet.marginRightMm).toBeGreaterThan(0);
      expect(sheet.heightMm - sheet.marginTopMm - sheet.marginBottomMm).toBeGreaterThan(0);
    });
  });
});
