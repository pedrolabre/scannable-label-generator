/**
 * Regras do logotipo da empresa, sem navegador.
 *
 * O logotipo e guardado como endereco de dados (`data:`) em PNG ou JPEG, os
 * dois formatos que a tela e a biblioteca de PDF desenham sem conversao. SVG
 * entra pelo carregamento e sai daqui como PNG: vetor guardado como texto
 * pediria um segundo caminho de desenho no PDF, e o rasterizador de SVG da
 * biblioteca fica fora do pacote.
 *
 * A imagem guardada tem teto de lado e de tamanho. O lado maximo da mais de
 * 600 dpi na maior zona de logotipo do catalogo, entao reduzir ate ele nao tira
 * nitidez do papel; o piso da reducao ainda passa de 300 dpi nessa zona. O teto
 * de bytes existe porque a configuracao inteira mora numa chave so do
 * armazenamento do navegador, dividindo a cota com o resto do aparelho.
 *
 * O arquivo escolhido pelo operador nao e recusado pelo tamanho: quem prepara a
 * imagem reduz o lado ate caber. Recusa so o que nao e imagem aceita e o que
 * nao abre.
 *
 * Funcoes puras: a conferencia le os bytes do cabecalho de cada formato, sem
 * decodificar a imagem.
 */

export const LOGO_FORMATS = Object.freeze({ PNG: 'PNG', JPEG: 'JPEG' });

/** Maior lado guardado, em pixels. */
export const LOGO_MAX_SIDE_PX = 1200;

/** Menor lado maior a que a reducao desce antes de trocar o formato. */
export const LOGO_MIN_SIDE_PX = 600;

/** Passo de cada reducao, quando a imagem ainda passa do teto de bytes. */
export const LOGO_REDUCTION_STEP = 0.8;

/** Teto da imagem guardada, em bytes da imagem (antes da codificacao em texto). */
export const LOGO_MAX_BYTES = 512 * 1024;

/** Qualidade do JPEG gravado: alta o bastante para nao marcar o traco impresso. */
export const LOGO_JPEG_QUALITY = 0.95;

export const LOGO_SOURCE_KINDS = Object.freeze({ PNG: 'png', JPEG: 'jpeg', SVG: 'svg' });

/** O que o seletor de arquivo oferece. */
export const LOGO_ACCEPT = 'image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg';

export const LOGO_MESSAGES = Object.freeze({
  sourceType: 'Use uma imagem PNG, JPEG ou SVG.',
  unreadable: 'Não foi possível abrir a imagem. Confira se o arquivo não está corrompido.',
  noSize: 'O SVG não declara largura e altura, e não dá para saber a proporção dele.',
  storedType: 'O logotipo guardado precisa ser PNG ou JPEG.',
  storedContent: 'O conteúdo do logotipo não é uma imagem PNG ou JPEG válida.',
  storedSide: `O logotipo passa de ${LOGO_MAX_SIDE_PX} px de lado.`,
  storedBytes: `O logotipo passa de ${LOGO_MAX_BYTES / 1024} KB mesmo reduzido.`,
});

export class LogoImageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LogoImageError';
  }
}

const MIME_BY_FORMAT = Object.freeze({ PNG: 'image/png', JPEG: 'image/jpeg' });
const DATA_URL = /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

const KIND_BY_TYPE = Object.freeze({
  'image/png': LOGO_SOURCE_KINDS.PNG,
  'image/jpeg': LOGO_SOURCE_KINDS.JPEG,
  'image/jpg': LOGO_SOURCE_KINDS.JPEG,
  'image/pjpeg': LOGO_SOURCE_KINDS.JPEG,
  'image/svg+xml': LOGO_SOURCE_KINDS.SVG,
});

const KIND_BY_EXTENSION = Object.freeze({
  png: LOGO_SOURCE_KINDS.PNG,
  jpg: LOGO_SOURCE_KINDS.JPEG,
  jpeg: LOGO_SOURCE_KINDS.JPEG,
  svg: LOGO_SOURCE_KINDS.SVG,
});

/**
 * Tipo do arquivo escolhido, pelo tipo que o navegador informa ou, quando ele
 * vem vazio, pela extensao do nome. Lanca para qualquer outro tipo.
 */
export function classifyLogoSource({ type = '', name = '' } = {}) {
  const byType = KIND_BY_TYPE[type.toLowerCase()];

  if (byType) {
    return byType;
  }

  const extension = name.toLowerCase().match(/\.([a-z]+)$/)?.[1];
  const byExtension = type === '' ? KIND_BY_EXTENSION[extension] : undefined;

  if (byExtension) {
    return byExtension;
  }

  throw new LogoImageError(LOGO_MESSAGES.sourceType);
}

/** Formato em que cada tipo de origem e guardado. */
export function storedFormatFor(kind) {
  return kind === LOGO_SOURCE_KINDS.JPEG ? LOGO_FORMATS.JPEG : LOGO_FORMATS.PNG;
}

export function logoMimeType(format) {
  return MIME_BY_FORMAT[format];
}

function scaleTo(widthPx, heightPx, longSidePx) {
  const factor = longSidePx / Math.max(widthPx, heightPx);

  return {
    widthPx: Math.max(1, Math.round(widthPx * factor)),
    heightPx: Math.max(1, Math.round(heightPx * factor)),
  };
}

/**
 * Medidas que a preparacao tenta, em ordem, ate uma caber no teto de bytes.
 *
 * A primeira respeita o lado maximo: imagem rasterizada maior e reduzida, e
 * menor fica como esta, porque ampliar pixel nao cria detalhe. Vetor nao tem
 * pixel, entao e rasterizado ja no lado maximo. As seguintes encolhem por passo
 * fixo ate o piso.
 */
export function logoSizeSteps(widthPx, heightPx, { vector = false } = {}) {
  if (!(widthPx > 0) || !(heightPx > 0)) {
    throw new LogoImageError(vector ? LOGO_MESSAGES.noSize : LOGO_MESSAGES.unreadable);
  }

  const longSide = Math.max(widthPx, heightPx);
  const firstSide = vector ? LOGO_MAX_SIDE_PX : Math.min(longSide, LOGO_MAX_SIDE_PX);
  const steps = [scaleTo(widthPx, heightPx, firstSide)];

  for (let side = firstSide * LOGO_REDUCTION_STEP; side >= LOGO_MIN_SIDE_PX; side *= LOGO_REDUCTION_STEP) {
    steps.push(scaleTo(widthPx, heightPx, Math.round(side)));
  }

  return Object.freeze(steps.map((step) => Object.freeze(step)));
}

/** Bytes da imagem que um trecho em base64 representa, sem decodificar. */
export function base64ByteLength(base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;

  return (base64.length / 4) * 3 - padding;
}

function decodeHead(base64, byteCount) {
  // So o comeco do arquivo interessa ao PNG; o JPEG pode pedir o arquivo todo
  // para achar o marcador de quadro.
  const chars = Math.min(base64.length, Math.ceil(byteCount / 3) * 4);
  const binary = atob(base64.slice(0, chars));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function readUint32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readPngSize(bytes) {
  const signed = PNG_SIGNATURE.every((value, index) => bytes[index] === value);
  const ihdr = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) === 'IHDR';

  return signed && ihdr ? { widthPx: readUint32(bytes, 16), heightPx: readUint32(bytes, 20) } : null;
}

/** Marcadores de inicio de quadro do JPEG, onde moram largura e altura. */
const JPEG_FRAME_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function readJpegSize(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }

    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];

    if (JPEG_FRAME_MARKERS.has(marker)) {
      return {
        heightPx: (bytes[offset + 5] << 8) | bytes[offset + 6],
        widthPx: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }

    offset += 2 + length;
  }

  return null;
}

/**
 * Confere o logotipo guardado e devolve formato, medida e bytes. Lanca com a
 * frase do problema: tipo fora de PNG e JPEG, conteudo que nao e o formato
 * declarado, lado acima do maximo ou bytes acima do teto.
 */
export function inspectLogoDataUrl(dataUrl) {
  const match = typeof dataUrl === 'string' ? dataUrl.match(DATA_URL) : null;

  if (!match) {
    const declared = typeof dataUrl === 'string' && /^data:image\/(png|jpeg);base64,/.test(dataUrl);

    throw new LogoImageError(declared ? LOGO_MESSAGES.storedContent : LOGO_MESSAGES.storedType);
  }

  const [, mime, base64] = match;
  const format = mime === MIME_BY_FORMAT.PNG ? LOGO_FORMATS.PNG : LOGO_FORMATS.JPEG;
  const bytes = base64ByteLength(base64);

  if (bytes > LOGO_MAX_BYTES) {
    throw new LogoImageError(LOGO_MESSAGES.storedBytes);
  }

  let size = null;

  try {
    size =
      format === LOGO_FORMATS.PNG
        ? readPngSize(decodeHead(base64, 24))
        : readJpegSize(decodeHead(base64, bytes));
  } catch {
    size = null;
  }

  if (!size || size.widthPx < 1 || size.heightPx < 1) {
    throw new LogoImageError(LOGO_MESSAGES.storedContent);
  }

  if (size.widthPx > LOGO_MAX_SIDE_PX || size.heightPx > LOGO_MAX_SIDE_PX) {
    throw new LogoImageError(LOGO_MESSAGES.storedSide);
  }

  return Object.freeze({ format, widthPx: size.widthPx, heightPx: size.heightPx, bytes });
}

/** Logotipo pronto para desenhar, ou nulo quando o guardado nao passa. */
export function resolveLogo(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl === '') {
    return null;
  }

  try {
    return Object.freeze({ dataUrl, ...inspectLogoDataUrl(dataUrl) });
  } catch {
    return null;
  }
}
