// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import ShellColumn from './ShellColumn.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function render(ui) {
  act(() => {
    root.render(ui);
  });
}

function longBody() {
  return Array.from({ length: 200 }, (_, index) => <p key={index}>Produto {index}</p>);
}

function body() {
  return container.querySelector('[data-corpo]');
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

describe('estrutura da regiao', () => {
  it('nomeia a regiao pelo proprio titulo quando nao recebe rotulo', () => {
    render(<ShellColumn title="Trabalho de impressão">conteúdo</ShellColumn>);

    const secao = container.querySelector('section');

    expect(secao.getAttribute('aria-label')).toBe('Trabalho de impressão');
  });

  it('prefere o rotulo ao titulo quando os dois chegam', () => {
    render(
      <ShellColumn title="Prévia" label="Prévia da etiqueta">
        conteúdo
      </ShellColumn>,
    );

    expect(container.querySelector('section').getAttribute('aria-label')).toBe(
      'Prévia da etiqueta',
    );
  });

  it('troca a faixa fixa inteira quando recebe um cabecalho proprio', () => {
    render(
      <ShellColumn label="Produtos" header={<div data-busca="">busca</div>}>
        conteúdo
      </ShellColumn>,
    );

    expect(container.querySelector('[data-busca]')).not.toBeNull();
    expect(container.querySelector('h2')).toBeNull();
  });

  it('aceita declarar que a regiao nao tem faixa fixa nenhuma', () => {
    render(
      <ShellColumn label="Produtos" header={null}>
        conteúdo
      </ShellColumn>,
    );

    expect(container.querySelector('h2')).toBeNull();
  });
});

describe('o corpo e quem rola', () => {
  /**
   * O `jsdom` nao faz layout: altura, rolagem e o que fica visivel saem todos
   * zero. O que se prova aqui e o contrato que produz o resultado — a cadeia
   * `min-height: 0` que faz o `overflow-y` valer dentro de flex, e a posicao
   * relativa do cabecalho, que fica fora da area que rola.
   */
  it('deixa o corpo rolar na vertical', () => {
    render(
      <ShellColumn title="Produtos">{longBody()}</ShellColumn>,
    );

    expect(body().className).toContain('overflow-y-auto');
  });

  it('deixa o corpo encolher abaixo do proprio conteudo', () => {
    render(<ShellColumn title="Produtos">{longBody()}</ShellColumn>);

    expect(container.querySelector('section').className).toContain('min-h-0');
    expect(body().className).toContain('min-h-0');
  });

  it('mantem o cabecalho fora da area que rola, com corpo longo', () => {
    render(<ShellColumn title="Produtos">{longBody()}</ShellColumn>);

    const titulo = container.querySelector('h2');

    expect(titulo.textContent).toBe('Produtos');
    expect(body().contains(titulo)).toBe(false);
  });

  it('mantem o rodape fora da area que rola, com corpo longo', () => {
    render(
      <ShellColumn title="Produtos" footer={<button type="button">Exportar PDF</button>}>
        {longBody()}
      </ShellColumn>,
    );

    const rodape = container.querySelector('button');

    expect(rodape.textContent).toBe('Exportar PDF');
    expect(body().contains(rodape)).toBe(false);
  });

  it('nao desenha rodape quando nao recebe nenhum', () => {
    render(<ShellColumn title="Produtos">conteúdo</ShellColumn>);

    expect(container.querySelector('button')).toBeNull();
  });
});
