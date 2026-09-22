/**
 * Leitura dos bytes de um PDF ja gerado.
 *
 * O que `pdf.js` promete — escala fisica, simbolo quadrado, area branca vazada —
 * so se confere no arquivo que sai, e nao na descricao que o originou. Conferir
 * o arquivo exige descomprimir os fluxos de conteudo, separar os subcaminhos do
 * desenho e decidir se um ponto caiu em area preenchida ou em area vazada. Isso
 * e um leitor de formato, e nao uma afirmacao sobre etiqueta: mora aqui, ao lado
 * de quem escreve o arquivo, em vez de crescer dentro da conferencia.
 *
 * Nenhum modulo da aplicacao importa este arquivo, e o empacotador nao o alcanca.
 * As funcoes sao puras e nao conhecem produto, etiqueta nem folha.
 */

import { inflateSync } from 'node:zlib';

/** O arquivo lido como texto de um byte por caractere, sem reinterpretar acento. */
export function asLatin1(bytes) {
  return Buffer.from(bytes).toString('latin1');
}

/** Fluxos de conteudo descomprimidos e concatenados. */
export function readContent(bytes) {
  const raw = asLatin1(bytes);

  return [...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)]
    .map((match) => {
      try {
        return inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      } catch {
        return '';
      }
    })
    .join('\n');
}

/** Caixa de midia de cada pagina, em ponto, na ordem em que aparecem. */
export function readMediaBoxes(bytes) {
  return [...asLatin1(bytes).matchAll(/\/MediaBox \[([^\]]*)\]/g)].map((match) =>
    match[1].trim().split(/\s+/).map(Number),
  );
}

/** Subcaminhos fechados do fluxo de conteudo, em ponto. */
export function readSubpaths(content) {
  const subpaths = [];
  let current = null;

  content.split('\n').forEach((line) => {
    const move = line.match(/^(-?[\d.]+) (-?[\d.]+) m$/);
    const draw = line.match(/^(-?[\d.]+) (-?[\d.]+) l$/);

    if (move) {
      current = [{ x: Number(move[1]), y: Number(move[2]) }];
      return;
    }

    if (draw && current) {
      current.push({ x: Number(draw[1]), y: Number(draw[2]) });
      return;
    }

    if (line.trim() === 'h' && current) {
      subpaths.push(current);
      current = null;
    }
  });

  return subpaths;
}

function side(from, to, point) {
  return (to.x - from.x) * (point.y - from.y) - (point.x - from.x) * (to.y - from.y);
}

/**
 * Numero de voltas do conjunto de subcaminhos em torno de um ponto. Zero
 * significa area vazada pela regra nao nula, que e a regra com que o simbolo e
 * preenchido.
 */
export function windingNumber(subpaths, point) {
  return subpaths.reduce((total, points) => {
    let winding = 0;

    points.forEach((from, index) => {
      const to = points[(index + 1) % points.length];

      if (from.y <= point.y) {
        if (to.y > point.y && side(from, to, point) > 0) {
          winding += 1;
        }
      } else if (to.y <= point.y && side(from, to, point) < 0) {
        winding -= 1;
      }
    });

    return total + winding;
  }, 0);
}

/** Retangulo envolvente de um conjunto de pontos, em ponto. */
export function boundingBox(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

/** Area do retangulo envolvente. Serve para ordenar subcaminhos por tamanho. */
export function area(points) {
  const box = boundingBox(points);

  return (box.right - box.left) * (box.bottom - box.top);
}

/** Verdadeiro quando o retangulo envolvente tem os dois lados iguais. */
export function isSquare(points) {
  const box = boundingBox(points);

  return Math.abs(box.right - box.left - (box.bottom - box.top)) < 1e-6;
}
