// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { JPEG_8X4_DATA_URL, pngBytes, pngDataUrl } from '../../lib/logoFixtures.js';

import {
  LOGO_FORMATS,
  LOGO_MAX_BYTES,
  LOGO_MAX_SIDE_PX,
  LOGO_MESSAGES,
  LOGO_MIN_SIDE_PX,
  LOGO_SOURCE_KINDS,
  LogoImageError,
  base64ByteLength,
  classifyLogoSource,
  inspectLogoDataUrl,
  logoSizeSteps,
  resolveLogo,
  storedFormatFor,
} from './logoImage.js';

function refusal(action) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(LogoImageError);
    return error.message;
  }

  throw new Error('era para recusar');
}

describe('arquivo escolhido', () => {
  it('aceita PNG, JPEG e SVG pelo tipo que o navegador informa', () => {
    expect(classifyLogoSource({ type: 'image/png', name: 'marca.png' })).toBe(LOGO_SOURCE_KINDS.PNG);
    expect(classifyLogoSource({ type: 'image/jpeg', name: 'marca.jpg' })).toBe(LOGO_SOURCE_KINDS.JPEG);
    expect(classifyLogoSource({ type: 'image/svg+xml', name: 'marca.svg' })).toBe(LOGO_SOURCE_KINDS.SVG);
  });

  it('usa a extensao quando o navegador nao informa o tipo', () => {
    expect(classifyLogoSource({ type: '', name: 'MARCA.JPEG' })).toBe(LOGO_SOURCE_KINDS.JPEG);
    expect(classifyLogoSource({ type: '', name: 'marca.svg' })).toBe(LOGO_SOURCE_KINDS.SVG);
  });

  it('recusa qualquer outro tipo com a frase dos formatos aceitos', () => {
    for (const file of [
      { type: 'image/gif', name: 'marca.gif' },
      { type: 'image/webp', name: 'marca.webp' },
      { type: 'application/pdf', name: 'marca.png' },
      { type: '', name: 'marca' },
    ]) {
      expect(refusal(() => classifyLogoSource(file))).toBe(LOGO_MESSAGES.sourceType);
    }
  });

  it('guarda SVG e PNG como PNG, e JPEG como JPEG', () => {
    expect(storedFormatFor(LOGO_SOURCE_KINDS.SVG)).toBe(LOGO_FORMATS.PNG);
    expect(storedFormatFor(LOGO_SOURCE_KINDS.PNG)).toBe(LOGO_FORMATS.PNG);
    expect(storedFormatFor(LOGO_SOURCE_KINDS.JPEG)).toBe(LOGO_FORMATS.JPEG);
  });
});

describe('medidas da reducao', () => {
  it('reduz a imagem grande ate o lado maximo, sem distorcer', () => {
    const [first] = logoSizeSteps(4000, 1000);

    expect(first).toEqual({ widthPx: LOGO_MAX_SIDE_PX, heightPx: 300 });
  });

  it('deixa a imagem pequena como esta, porque ampliar pixel nao cria detalhe', () => {
    expect(logoSizeSteps(320, 80)[0]).toEqual({ widthPx: 320, heightPx: 80 });
  });

  it('rasteriza o SVG ja no lado maximo, mesmo quando ele declara medida pequena', () => {
    expect(logoSizeSteps(100, 40, { vector: true })[0]).toEqual({ widthPx: LOGO_MAX_SIDE_PX, heightPx: 480 });
  });

  it('encolhe por passos e para no piso', () => {
    const steps = logoSizeSteps(3000, 3000);
    const sides = steps.map((step) => step.widthPx);

    expect(sides[0]).toBe(LOGO_MAX_SIDE_PX);
    expect(sides.every((side, index) => index === 0 || side < sides[index - 1])).toBe(true);
    expect(Math.min(...sides)).toBeGreaterThanOrEqual(LOGO_MIN_SIDE_PX);
  });

  it('recusa a imagem sem medida, com a frase propria do SVG', () => {
    expect(refusal(() => logoSizeSteps(0, 0, { vector: true }))).toBe(LOGO_MESSAGES.noSize);
    expect(refusal(() => logoSizeSteps(0, 10))).toBe(LOGO_MESSAGES.unreadable);
  });
});

describe('logotipo guardado', () => {
  it('le formato e medida do PNG pelo cabecalho', () => {
    expect(inspectLogoDataUrl(pngDataUrl(300, 60))).toMatchObject({
      format: LOGO_FORMATS.PNG,
      widthPx: 300,
      heightPx: 60,
    });
  });

  it('le formato e medida do JPEG pelo marcador de quadro', () => {
    expect(inspectLogoDataUrl(JPEG_8X4_DATA_URL)).toMatchObject({
      format: LOGO_FORMATS.JPEG,
      widthPx: 8,
      heightPx: 4,
    });
  });

  it('recusa tipo fora de PNG e JPEG', () => {
    expect(refusal(() => inspectLogoDataUrl('data:image/gif;base64,R0lGODlhAQABAAAAACw='))).toBe(
      LOGO_MESSAGES.storedType,
    );
    expect(refusal(() => inspectLogoDataUrl('data:image/svg+xml;base64,PHN2Zy8+'))).toBe(
      LOGO_MESSAGES.storedType,
    );
  });

  it('recusa conteudo que nao e o formato declarado ou que esta corrompido', () => {
    const jpegAsPng = JPEG_8X4_DATA_URL.replace('image/jpeg', 'image/png');

    expect(refusal(() => inspectLogoDataUrl(jpegAsPng))).toBe(LOGO_MESSAGES.storedContent);
    expect(refusal(() => inspectLogoDataUrl('data:image/png;base64,nao*e*base64'))).toBe(
      LOGO_MESSAGES.storedContent,
    );
    expect(refusal(() => inspectLogoDataUrl('data:image/png;base64,AAAA'))).toBe(LOGO_MESSAGES.storedContent);
  });

  it('recusa lado acima do maximo', () => {
    const wide = `data:image/png;base64,${pngBytes(LOGO_MAX_SIDE_PX + 1, 1).toString('base64')}`;

    expect(refusal(() => inspectLogoDataUrl(wide))).toBe(LOGO_MESSAGES.storedSide);
  });

  it('recusa bytes acima do teto', () => {
    const header = pngBytes(10, 10);
    const padded = Buffer.concat([header, Buffer.alloc(LOGO_MAX_BYTES - header.length + 1)]);
    const base64 = padded.toString('base64');

    expect(base64ByteLength(base64)).toBe(LOGO_MAX_BYTES + 1);
    expect(refusal(() => inspectLogoDataUrl(`data:image/png;base64,${base64}`))).toBe(
      LOGO_MESSAGES.storedBytes,
    );
  });

  it('resolve para desenho so o que passa, e nulo no resto', () => {
    const dataUrl = pngDataUrl(40, 20);

    expect(resolveLogo(dataUrl)).toMatchObject({ dataUrl, format: 'PNG', widthPx: 40, heightPx: 20 });
    expect(Object.isFrozen(resolveLogo(dataUrl))).toBe(true);
    expect(resolveLogo('')).toBeNull();
    expect(resolveLogo('data:image/png;base64,AAAA')).toBeNull();
    expect(resolveLogo(undefined)).toBeNull();
  });
});
