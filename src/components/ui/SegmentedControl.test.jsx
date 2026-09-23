// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SegmentedControl from './SegmentedControl.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS = [
  { value: 'impressao', label: 'Impressão' },
  { value: 'produtos', label: 'Produtos' },
  { value: 'previa', label: 'Prévia' },
];

let container;
let root;

function Controlado({ inicial = 'produtos', onChange = () => {}, ...props }) {
  const [value, setValue] = useState(inicial);

  return (
    <SegmentedControl
      legend="Vista"
      name="vista"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      {...props}
    />
  );
}

function render(ui) {
  act(() => {
    root.render(ui);
  });
}

function radios(grupo = container) {
  return Array.from(grupo.querySelectorAll('input[type="radio"]'));
}

function marcado(grupo = container) {
  return radios(grupo).filter((radio) => radio.checked);
}

function tecla(key) {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

  act(() => {
    document.activeElement.dispatchEvent(evento);
  });

  return evento;
}

function focar(indice) {
  act(() => {
    radios()[indice].focus();
  });
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

describe('opcao marcada', () => {
  it('marca exatamente uma opcao por grupo', () => {
    render(<Controlado />);

    expect(marcado()).toHaveLength(1);
    expect(marcado()[0].value).toBe('produtos');
  });

  it('mantem uma so em cada grupo quando dois grupos convivem', () => {
    render(
      <>
        <Controlado name="vista-a" inicial="impressao" />
        <Controlado name="vista-b" inicial="previa" />
      </>,
    );

    const grupos = container.querySelectorAll('fieldset');

    expect(marcado(grupos[0]).map((radio) => radio.value)).toEqual(['impressao']);
    expect(marcado(grupos[1]).map((radio) => radio.value)).toEqual(['previa']);
  });

  it('continua com uma so depois do clique', () => {
    render(<Controlado />);

    act(() => {
      radios()[2].click();
    });

    expect(marcado().map((radio) => radio.value)).toEqual(['previa']);
  });
});

describe('teclado', () => {
  it('anda para a proxima opcao com a seta para a direita e para baixo', () => {
    const onChange = vi.fn();
    render(<Controlado onChange={onChange} />);
    focar(1);

    tecla('ArrowRight');
    expect(marcado().map((radio) => radio.value)).toEqual(['previa']);
    expect(document.activeElement).toBe(radios()[2]);

    tecla('ArrowDown');
    expect(marcado().map((radio) => radio.value)).toEqual(['impressao']);
    expect(onChange.mock.calls.map(([valor]) => valor)).toEqual(['previa', 'impressao']);
  });

  it('volta com a seta para a esquerda e para cima, dando a volta no inicio', () => {
    render(<Controlado inicial="impressao" />);
    focar(0);

    tecla('ArrowLeft');
    expect(marcado().map((radio) => radio.value)).toEqual(['previa']);

    tecla('ArrowUp');
    expect(marcado().map((radio) => radio.value)).toEqual(['produtos']);
    expect(document.activeElement).toBe(radios()[1]);
  });

  it('vai as pontas com Home e End', () => {
    render(<Controlado />);
    focar(1);

    tecla('End');
    expect(marcado().map((radio) => radio.value)).toEqual(['previa']);

    tecla('Home');
    expect(marcado().map((radio) => radio.value)).toEqual(['impressao']);
  });

  it('cancela o movimento nativo, para a mesma tecla nao andar duas casas', () => {
    render(<Controlado />);
    focar(1);

    expect(tecla('ArrowRight').defaultPrevented).toBe(true);
    expect(tecla('Tab').defaultPrevented).toBe(false);
  });
});

describe('forma', () => {
  it('guarda o titulo so para leitor de tela quando pedido', () => {
    render(<Controlado hideLegend />);

    const titulo = container.querySelector('legend');

    expect(titulo.textContent).toBe('Vista');
    expect(titulo.className).toContain('sr-only');
  });

  it('reparte a largura inteira entre as opcoes quando pedido', () => {
    render(<Controlado stretch />);

    const faixa = container.querySelector('fieldset > div');

    expect(faixa.className).toContain('grid');
    expect(faixa.className).toContain('auto-cols-fr');
  });

  it('segue a altura de controle da tela, e nao uma medida fixa', () => {
    render(<Controlado />);

    const opcao = container.querySelector('label span');

    expect(opcao.className).toContain('h-controle');
    expect(opcao.className).not.toContain('h-11');
  });
});
