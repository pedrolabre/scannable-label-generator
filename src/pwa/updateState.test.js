// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  announceUpdate,
  applyPendingUpdate,
  getUpdateSnapshot,
  resetUpdateState,
  subscribeToUpdate,
} from './updateState.js';

/**
 * O modulo e o unico ponto em que o registro do service worker encosta na tela,
 * e nao depende de navegador nenhum: o que se prova aqui e o sinalizador, o
 * aviso aos assinantes e a garantia de que a troca so e aplicada uma vez.
 */

afterEach(() => {
  resetUpdateState();
});

describe('sinalizador de versao nova', () => {
  it('comeca apagado', () => {
    expect(getUpdateSnapshot()).toBe(false);
  });

  it('acende quando o registro anuncia a versao nova', () => {
    announceUpdate(() => {});

    expect(getUpdateSnapshot()).toBe(true);
  });

  it('devolve o mesmo valor em leituras seguidas, sem objeto novo a cada chamada', () => {
    announceUpdate(() => {});

    expect(getUpdateSnapshot()).toBe(getUpdateSnapshot());
  });
});

describe('aviso aos assinantes', () => {
  it('avisa quem assinou a cada mudanca', () => {
    const listener = vi.fn();

    subscribeToUpdate(listener);
    announceUpdate(() => {});

    expect(listener).toHaveBeenCalledTimes(1);

    applyPendingUpdate();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('para de avisar depois do cancelamento', () => {
    const listener = vi.fn();
    const cancelar = subscribeToUpdate(listener);

    cancelar();
    announceUpdate(() => {});

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('aplicacao da troca', () => {
  it('chama a acao anunciada e apaga o sinalizador', () => {
    const aplicar = vi.fn();

    announceUpdate(aplicar);

    expect(applyPendingUpdate()).toBe(true);
    expect(aplicar).toHaveBeenCalledTimes(1);
    expect(getUpdateSnapshot()).toBe(false);
  });

  it('recusa quando nao ha nada pendente, sem prometer troca', () => {
    expect(applyPendingUpdate()).toBe(false);
  });

  it('nao aplica a mesma troca duas vezes', () => {
    const aplicar = vi.fn();

    announceUpdate(aplicar);
    applyPendingUpdate();

    expect(applyPendingUpdate()).toBe(false);
    expect(aplicar).toHaveBeenCalledTimes(1);
  });

  it('mantem a ultima descoberta quando o anuncio se repete', () => {
    const antiga = vi.fn();
    const nova = vi.fn();

    announceUpdate(antiga);
    announceUpdate(nova);
    applyPendingUpdate();

    expect(antiga).not.toHaveBeenCalled();
    expect(nova).toHaveBeenCalledTimes(1);
  });
});
