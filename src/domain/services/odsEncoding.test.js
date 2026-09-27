// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { hasCp850Misreading, repairCp850Misreading } from './odsEncoding.js';

describe('hasCp850Misreading', () => {
  it('reconhece so os caracteres de moldura que a leitura errada deixa', () => {
    for (const text of ['BALC├O', 'VERIT┴', 'LAMPADA ═', 'CANTONEIRA ╔', 'N║ 3']) {
      expect(hasCp850Misreading(text)).toBe(true);
    }

    for (const text of ['FogÒo a gßs', 'Fogão a gás', 'ARMARIO AÇO Nº 3', 'MESA 1,20 M']) {
      expect(hasCp850Misreading(text)).toBe(false);
    }
  });
});

describe('repairCp850Misreading', () => {
  it('devolve o acento que o texto tinha antes da leitura na pagina 850', () => {
    expect(repairCp850Misreading('FogÒo a gßs')).toBe('Fogão a gás');
    expect(repairCp850Misreading('BALC├O')).toBe('BALCÃO');
    expect(repairCp850Misreading('VERIT┴')).toBe('VERITÁ');
    expect(repairCp850Misreading('N├O')).toBe('NÃO');
    expect(repairCp850Misreading('SEGURANÃA')).toBe('SEGURANÇA');
    expect(repairCp850Misreading('MÈNACO')).toBe('MÔNACO');
    expect(repairCp850Misreading('FunþÒo')).toBe('Função');
    expect(repairCp850Misreading('L┬MINAS DE AÃO')).toBe('LÂMINAS DE AÇO');
    expect(repairCp850Misreading('Niter¾i Tamba· DobuÛ Sem Ëleo')).toBe('Niterói Tambaú Dobuê Sem Óleo');
  });

  it('mantem o ASCII, o Ç e o º que ja chegaram certos e o espaco sem quebra', () => {
    const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');

    expect(repairCp850Misreading(ascii)).toBe(ascii);
    expect(repairCp850Misreading('ARMARIO AÇO Nº 3')).toBe('ARMARIO AÇO Nº 3');
    expect(repairCp850Misreading('140 W INVENTADO')).toBe('140 W INVENTADO');
  });

  it('deixa como esta o caractere que nao existe na pagina 850', () => {
    expect(repairCp850Misreading('PRECO € 10 — OFERTA')).toBe('PRECO € 10 — OFERTA');
  });
});
