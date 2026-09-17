/**
 * Adaptador entre a descricao do documento e a biblioteca de PDF.
 *
 * Aqui e o unico lugar em que a descricao vira chamada de biblioteca. O
 * documento e aberto em milimetro, a mesma unidade em que a descricao foi
 * escrita, e a conversao para ponto e feita pela propria biblioteca: um fator
 * escrito a mao seria o mesmo numero, arredondado, em mais um lugar para
 * conferir.
 *
 * O texto e escrito com uma das fontes que a biblioteca ja traz, sem carregar
 * arquivo de fonte e sem pedir nada a rede. A acentuacao completa do portugues
 * sai por essa fonte, e as reticencias do corte tambem.
 *
 * A saida e deterministica. A data de criacao chega de fora e o identificador
 * do documento sai do proprio conteudo, entao a mesma entrada produz o mesmo
 * arquivo byte a byte, e dois conteudos diferentes nao compartilham
 * identificador.
 *
 * A geracao cede o laco de eventos entre paginas. A pagina e a menor unidade
 * que faz sentido interromper, e sem essa pausa uma tiragem grande congelaria a
 * interface do comeco ao fim.
 */

import { APP_NAME } from './app-meta.js';
import { trimToWidth } from '../domain/services/printText.js';

const FONT = 'helvetica';
const FONT_STYLE_BOLD = 'bold';
const FONT_STYLE_NORMAL = 'normal';

/** Milimetros por ponto tipografico. A biblioteca recebe o corpo em ponto. */
const MM_PER_POINT = 25.4 / 72;

let enginePromise = null;

function loadEngine() {
  if (enginePromise === null) {
    enginePromise = import('./pdfEngine.js');
  }

  return enginePromise;
}

function yieldToEventLoop() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Identificador do documento derivado do conteudo, por avalanche simples em
 * quatro passagens. Nao e resumo criptografico e nao precisa ser: serve para
 * que arquivos iguais tenham o mesmo identificador e arquivos diferentes nao.
 */
function buildFileId(text) {
  const seeds = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];

  return seeds
    .map((seed) => {
      let hash = seed;

      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }

      return hash.toString(16).padStart(8, '0');
    })
    .join('');
}

/** Data de criacao no formato do PDF, sempre em tempo universal. */
function formatCreationDate(date) {
  const iso = new Date(date.getTime()).toISOString();

  return `D:${iso.slice(0, 19).replace(/\D/g, '')}+00'00'`;
}

function applyGray(doc, gray) {
  doc.setDrawColor(gray, gray, gray);
}

function drawText(doc, op) {
  doc.setFont(FONT, op.bold ? FONT_STYLE_BOLD : FONT_STYLE_NORMAL);
  doc.setFontSize(op.fontSizeMm / MM_PER_POINT);

  const text = op.trim
    ? trimToWidth(op.text, op.widthMm, (candidate) => doc.getTextWidth(candidate))
    : op.text;

  if (text.length === 0) {
    return;
  }

  // A linha e centrada na altura que a geometria reservou, como a altura de
  // linha faz na tela; o texto centrado tambem parte do meio da caixa.
  const yMm = op.yMm + op.lineHeightMm / 2;
  const xMm = op.align === 'center' ? op.xMm + op.widthMm / 2 : op.xMm;

  doc.text(text, xMm, yMm, { baseline: 'middle', align: op.align });
}

function drawPage(doc, page) {
  page.ops.forEach((op) => {
    if (op.type === 'rect') {
      doc.setFillColor(255, 255, 255);
      doc.rect(op.xMm, op.yMm, op.widthMm, op.heightMm, 'F');
      return;
    }

    if (op.type === 'outline') {
      applyGray(doc, op.gray);
      doc.setLineWidth(op.lineWidthMm);
      doc.setLineDashPattern(op.dashMm === null ? [] : [op.dashMm, op.dashMm], 0);
      doc.rect(op.xMm, op.yMm, op.widthMm, op.heightMm, 'S');
      doc.setLineDashPattern([], 0);
      return;
    }

    if (op.type === 'path') {
      doc.setFillColor(0, 0, 0);

      const commands = [];

      op.subpaths.forEach((points) => {
        points.forEach((point, index) => {
          commands.push({ op: index === 0 ? 'm' : 'l', c: [point.xMm, point.yMm] });
        });

        commands.push({ op: 'h', c: [] });
      });

      doc.path(commands);
      // Preenchimento pela regra nao nula: e ela que mantem vazado o quadrado
      // interno dos padroes de localizacao, desenhados em sentido contrario.
      doc.fill();
      return;
    }

    drawText(doc, op);
  });
}

/**
 * Gera os bytes do PDF a partir da descricao. `createdAt` entra por parametro
 * para que a saida seja conferivel byte a byte; `onProgress` recebe a folha
 * concluida e o total.
 */
export async function renderPrintDocument(description, { createdAt, onProgress } = {}) {
  const { jsPDF } = await loadEngine();
  const [first] = description.pages;

  if (!first) {
    throw new Error('O documento nao tem nenhuma folha para gerar.');
  }

  const doc = new jsPDF({
    unit: 'mm',
    format: [first.widthMm, first.heightMm],
    orientation: first.widthMm > first.heightMm ? 'landscape' : 'portrait',
    compress: true,
    putOnlyUsedFonts: true,
  });

  const date = createdAt instanceof Date ? createdAt : new Date();

  doc.setCreationDate(formatCreationDate(date));
  doc.setFileId(buildFileId(JSON.stringify(description)));
  doc.setDocumentProperties({
    title: description.title,
    author: APP_NAME,
    creator: APP_NAME,
  });

  for (let index = 0; index < description.pages.length; index += 1) {
    const page = description.pages[index];

    if (index > 0) {
      doc.addPage([page.widthMm, page.heightMm], page.widthMm > page.heightMm ? 'landscape' : 'portrait');
    }

    drawPage(doc, page);

    if (typeof onProgress === 'function') {
      onProgress(index + 1, description.pages.length);
    }

    if (index + 1 < description.pages.length) {
      await yieldToEventLoop();
    }
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
