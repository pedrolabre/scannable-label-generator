/**
 * Preparacao do arquivo de logotipo no navegador.
 *
 * O arquivo escolhido pelo operador passa sempre por uma tela de desenho antes
 * de ser guardado. Isso resolve tres coisas de uma vez: SVG vira PNG, a imagem
 * grande e reduzida ate o lado maximo, e toda imagem sai num PNG ou JPEG comum,
 * de 8 bits por canal, que a biblioteca de PDF le sem surpresa — um PNG de 16
 * bits ou um JPEG em CMYK chegariam la tal como vieram.
 *
 * PNG e SVG saem em PNG, que nao perde nada e guarda a transparencia. JPEG sai
 * em JPEG de qualidade alta. Quando a imagem passa do teto de bytes, o lado
 * encolhe por passos ate o piso; se nem assim couber, o PNG vira JPEG sobre
 * fundo branco, que e a cor da etiqueta. As medidas e os tetos sao regras do
 * dominio, em `logoImage.js`; aqui mora so o que precisa do navegador.
 */

import {
  LOGO_FORMATS,
  LOGO_JPEG_QUALITY,
  LOGO_MAX_BYTES,
  LOGO_MESSAGES,
  LOGO_SOURCE_KINDS,
  LogoImageError,
  base64ByteLength,
  classifyLogoSource,
  logoMimeType,
  logoSizeSteps,
  storedFormatFor,
} from '../domain/services/logoImage.js';

const WHITE = '#FFFFFF';

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new LogoImageError(LOGO_MESSAGES.unreadable));
    };
    image.src = url;
  });
}

function encode(image, { widthPx, heightPx }, format) {
  const canvas = document.createElement('canvas');

  canvas.width = widthPx;
  canvas.height = heightPx;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new LogoImageError(LOGO_MESSAGES.unreadable);
  }

  if (format === LOGO_FORMATS.JPEG) {
    context.fillStyle = WHITE;
    context.fillRect(0, 0, widthPx, heightPx);
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, widthPx, heightPx);

  return canvas.toDataURL(logoMimeType(format), LOGO_JPEG_QUALITY);
}

function fits(dataUrl) {
  return base64ByteLength(dataUrl.slice(dataUrl.indexOf(',') + 1)) <= LOGO_MAX_BYTES;
}

/**
 * Le o arquivo e devolve o endereco de dados pronto para guardar. Lanca
 * `LogoImageError` com a frase para o operador quando o arquivo nao e PNG, JPEG
 * ou SVG, quando nao abre, ou quando nenhuma reducao cabe no teto.
 */
export async function prepareLogo(file) {
  const kind = classifyLogoSource(file);
  const image = await loadImage(file);
  const steps = logoSizeSteps(image.naturalWidth, image.naturalHeight, {
    vector: kind === LOGO_SOURCE_KINDS.SVG,
  });
  const format = storedFormatFor(kind);

  try {
    for (const size of steps) {
      const dataUrl = encode(image, size, format);

      if (fits(dataUrl)) {
        return dataUrl;
      }
    }

    if (format === LOGO_FORMATS.PNG) {
      const flattened = encode(image, steps[steps.length - 1], LOGO_FORMATS.JPEG);

      if (fits(flattened)) {
        return flattened;
      }
    }
  } catch (error) {
    // Tela de desenho contaminada (SVG com conteudo externo) ou sem memoria.
    throw error instanceof LogoImageError ? error : new LogoImageError(LOGO_MESSAGES.unreadable);
  }

  throw new LogoImageError(LOGO_MESSAGES.storedBytes);
}
