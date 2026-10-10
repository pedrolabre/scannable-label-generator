export const CUT_GUIDES = Object.freeze({
  LIGHT: 'clara',
  STRONG: 'destacada',
});

export const CUT_GUIDE_VALUES = Object.freeze([CUT_GUIDES.LIGHT, CUT_GUIDES.STRONG]);

export const DEFAULT_CUT_GUIDE = CUT_GUIDES.LIGHT;

const STROKES = Object.freeze({
  [CUT_GUIDES.LIGHT]: Object.freeze({ lineWidthMm: 0.1, gray: 203 }),
  [CUT_GUIDES.STRONG]: Object.freeze({ lineWidthMm: 0.2, gray: 0 }),
});

export function resolveCutGuideStroke(cutGuide) {
  return STROKES[cutGuide] ?? STROKES[DEFAULT_CUT_GUIDE];
}
