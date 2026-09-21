// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  CONTRAST_MINIMUM,
  ContrastError,
  contrastRatio,
  meetsContrast,
  parseHexColor,
  relativeLuminance,
} from './contrast.js';

const BRANCO = '#ffffff';
const PRETO = '#000000';

// Superficies da aplicacao, com o nome que elas tem no padrao visual.
const FUNDO_CLARO = '#f8fafc';
const CARTAO_CLARO = '#ffffff';
const FUNDO_ESCURO = '#020617';
const CARTAO_ESCURO = '#0f172a';

/**
 * Os pares que a interface usa de verdade, cada um com o limiar do seu papel.
 * A tabela mora aqui, e nao no codigo da aplicacao, porque nada em tempo de
 * execucao a consulta: ela e a conferencia escrita de uma decisao de cor, e o
 * lugar de uma conferencia e o teste. Contraste de texto pede 4,5 para 1;
 * contorno, borda e outro elemento nao textual pedem 3 para 1.
 */
const PARES_DE_TEXTO = [
  ['branco sobre a acao principal', BRANCO, '#cf1026'],
  ['branco sobre a acao principal sob o ponteiro', BRANCO, '#ad0b1d'],
  ['branco sobre o cabecalho de preco da tabela', BRANCO, '#23824a'],
  ['marca sobre o cartao claro', '#cf1026', CARTAO_CLARO],
  ['marca sobre o fundo claro', '#cf1026', FUNDO_CLARO],
  ['perigo sobre o proprio fundo suave', '#b93a20', '#fff1ea'],
  ['perigo sobre o cartao claro', '#b93a20', CARTAO_CLARO],
  ['perigo no tema escuro', '#ffb8a7', '#3b211b'],
  ['codigo sobre o proprio fundo suave', '#8a5a00', '#fff8e6'],
  ['codigo sobre o cartao claro', '#8a5a00', CARTAO_CLARO],
  ['codigo no tema escuro', '#f4c95f', '#33280f'],
  ['codigo no tema escuro sobre o cartao', '#f4c95f', CARTAO_ESCURO],
  ['preco sobre o cartao claro', '#0f7a3d', CARTAO_CLARO],
  ['preco sobre o fundo claro', '#0f7a3d', FUNDO_CLARO],
  ['preco no tema escuro', '#4bd486', CARTAO_ESCURO],
  ['texto de apoio sobre o cartao claro', '#64748b', CARTAO_CLARO],
  ['texto de apoio no tema escuro', '#94a3b8', CARTAO_ESCURO],
  ['texto corrido sobre o cartao claro', '#475569', CARTAO_CLARO],
  ['confirmacao sobre o cartao claro', '#047857', CARTAO_CLARO],
];

const PARES_NAO_TEXTUAIS = [
  ['contorno de foco de marca sobre o fundo escuro', '#cf1026', FUNDO_ESCURO],
  ['contorno de foco de marca sobre o cartao escuro', '#cf1026', CARTAO_ESCURO],
  ['borda de foco do campo de preco sobre o cartao claro', '#159447', CARTAO_CLARO],
  ['borda de foco do campo de codigo sobre o cartao claro', '#8a5a00', CARTAO_CLARO],
  ['borda de foco de perigo sobre o cartao claro', '#b93a20', CARTAO_CLARO],
];

describe('leitura da cor', () => {
  it('le a forma curta e a forma longa como a mesma cor', () => {
    expect(parseHexColor('#fff')).toEqual([255, 255, 255]);
    expect(parseHexColor('#ffffff')).toEqual([255, 255, 255]);
    expect(parseHexColor('CF1026')).toEqual(parseHexColor('#cf1026'));
  });

  it('recusa o que nao e cor, em vez de devolver preto em silencio', () => {
    expect(() => parseHexColor('#12345')).toThrow(ContrastError);
    expect(() => parseHexColor('vermelho')).toThrow(ContrastError);
    expect(() => parseHexColor('#gggggg')).toThrow(ContrastError);
    expect(() => parseHexColor(null)).toThrow(ContrastError);
  });
});

describe('luminancia e razao', () => {
  it('coloca o branco e o preto nos extremos da escala', () => {
    expect(relativeLuminance(BRANCO)).toBeCloseTo(1, 5);
    expect(relativeLuminance(PRETO)).toBeCloseTo(0, 5);
  });

  it('devolve o extremo conhecido de 21 para 1 entre branco e preto', () => {
    expect(contrastRatio(BRANCO, PRETO)).toBeCloseTo(21, 5);
  });

  it('nao depende da ordem das duas cores', () => {
    expect(contrastRatio('#cf1026', BRANCO)).toBeCloseTo(contrastRatio(BRANCO, '#cf1026'), 10);
  });

  it('devolve 1 para 1 quando as duas cores sao a mesma', () => {
    expect(contrastRatio('#8a5a00', '#8a5a00')).toBeCloseTo(1, 10);
  });
});

describe('pares de texto da interface', () => {
  it.each(PARES_DE_TEXTO)('%s cumpre o minimo de texto', (_nome, frente, fundo) => {
    expect(contrastRatio(frente, fundo)).toBeGreaterThanOrEqual(CONTRAST_MINIMUM.text);
    expect(meetsContrast(frente, fundo, CONTRAST_MINIMUM.text)).toBe(true);
  });
});

describe('pares nao textuais da interface', () => {
  it.each(PARES_NAO_TEXTUAIS)('%s cumpre o minimo nao textual', (_nome, frente, fundo) => {
    expect(contrastRatio(frente, fundo)).toBeGreaterThanOrEqual(CONTRAST_MINIMUM.nonText);
  });
});

describe('tons que saem de uso por reprovarem no minimo', () => {
  it('registra por que o tom de apoio mais claro saiu do texto', () => {
    expect(contrastRatio('#94a3b8', CARTAO_CLARO)).toBeLessThan(CONTRAST_MINIMUM.text);
    expect(contrastRatio('#64748b', CARTAO_CLARO)).toBeGreaterThanOrEqual(CONTRAST_MINIMUM.text);
  });

  it('registra por que o tom de venda mais claro saiu do preco', () => {
    expect(contrastRatio('#0f8a45', CARTAO_CLARO)).toBeLessThan(CONTRAST_MINIMUM.text);
    expect(contrastRatio('#0f7a3d', CARTAO_CLARO)).toBeGreaterThanOrEqual(CONTRAST_MINIMUM.text);
  });

  it('registra por que o tom de apoio mais escuro saiu do texto no tema escuro', () => {
    expect(contrastRatio('#64748b', CARTAO_ESCURO)).toBeLessThan(CONTRAST_MINIMUM.text);
    expect(contrastRatio('#94a3b8', CARTAO_ESCURO)).toBeGreaterThanOrEqual(CONTRAST_MINIMUM.text);
  });
});
