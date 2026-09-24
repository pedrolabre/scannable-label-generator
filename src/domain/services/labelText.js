/**
 * Ajuste do texto as zonas fixas da etiqueta.
 *
 * O espaco e o que a geometria decidiu; o texto se adapta a ele e nunca o
 * contrario. Duas regras diferentes, porque o custo do erro e diferente:
 *
 * - O nome e cortado. Um nome pela metade continua identificando o produto, e
 *   a etiqueta nao pode crescer para acomoda-lo.
 * - O preco e o codigo numerico nao sao cortados, so diminuem de corpo em
 *   degraus. Preco cortado e preco errado, e codigo cortado deixa de bater com
 *   o que o simbolo devolve ao ser lido. So abaixo do ultimo degrau o codigo
 *   cede e e cortado, e ai ja se trata de um codigo absurdamente longo.
 *
 * A largura do texto sai de uma media de avanco por caractere, e nao de medicao
 * real: medir exigiria canvas ou DOM, o que tiraria estas funcoes da suite e
 * impediria a exportacao em PDF de reaproveitar exatamente a mesma regra. A
 * media erra para mais em nomes inteiros em caixa alta, e por isso quem desenha
 * a etiqueta recorta a zona no CSS como segunda garantia.
 */

/** Avanco medio de um caractere de texto corrido, em fracao do corpo. */
export const TEXT_ADVANCE_RATIO = 0.58;

/**
 * Avanco medio de texto em caixa alta e negrito, em fracao do corpo. O nome da
 * etiqueta sai assim, e com a media do texto corrido a linha estimada passaria
 * da largura real e o corte cairia no meio da linha, e nao no fim do nome.
 */
export const UPPERCASE_BOLD_ADVANCE_RATIO = 0.7;

/** Avanco de um algarismo em fonte de numeros tabulares, em fracao do corpo. */
export const DIGIT_ADVANCE_RATIO = 0.6;

/** Degraus de reducao do preco e do codigo numerico. */
export const FONT_SIZE_STEPS = Object.freeze([1, 0.85, 0.72]);

export const ELLIPSIS = '…';

export function textWidthMm(text, fontSizeMm, advanceRatio = TEXT_ADVANCE_RATIO) {
  return text.length * fontSizeMm * advanceRatio;
}

/** Quantos caracteres cabem na largura informada, no corpo informado. */
export function charBudget(widthMm, fontSizeMm, advanceRatio = TEXT_ADVANCE_RATIO) {
  if (fontSizeMm <= 0 || advanceRatio <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor(widthMm / (fontSizeMm * advanceRatio)));
}

function cutWithEllipsis(text, budget) {
  if (budget <= 0) {
    return '';
  }

  if (budget === 1) {
    return ELLIPSIS;
  }

  return `${text.slice(0, budget - 1).trimEnd()}${ELLIPSIS}`;
}

function breakIntoLines(text, budget) {
  const lines = [];
  let current = '';

  for (const word of text.split(/\s+/).filter(Boolean)) {
    let remaining = word;

    // Palavra maior que a linha inteira e quebrada; nenhuma outra cabe do lado.
    while (remaining.length > budget) {
      if (current.length > 0) {
        lines.push(current);
        current = '';
      }

      lines.push(remaining.slice(0, budget));
      remaining = remaining.slice(budget);
    }

    if (current.length === 0) {
      current = remaining;
      continue;
    }

    if (current.length + 1 + remaining.length <= budget) {
      current = `${current} ${remaining}`;
      continue;
    }

    lines.push(current);
    current = remaining;
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

/**
 * Distribui o nome pelas linhas da zona e corta o que nao couber. Devolve
 * sempre no maximo `zone.lines` linhas, e `truncated` diz se algo ficou de fora.
 */
export function fitNameLines(displayName, zone, advanceRatio = TEXT_ADVANCE_RATIO) {
  const budget = charBudget(zone.widthMm, zone.fontSizeMm, advanceRatio);
  const text = typeof displayName === 'string' ? displayName.trim() : '';

  if (budget === 0 || text.length === 0) {
    return { lines: [], truncated: text.length > 0, charBudget: budget };
  }

  const lines = breakIntoLines(text, budget);

  if (lines.length <= zone.lines) {
    return { lines, truncated: false, charBudget: budget };
  }

  const kept = lines.slice(0, zone.lines);
  kept[kept.length - 1] = cutWithEllipsis(kept[kept.length - 1], budget);

  return { lines: kept, truncated: true, charBudget: budget };
}

/**
 * Maior degrau de corpo em que o texto ainda cabe na largura. Devolve o ultimo
 * degrau quando nenhum serve, para que quem chama decida entre cortar e recusar.
 */
export function fitFontSizeMm(text, widthMm, baseFontSizeMm, advanceRatio = DIGIT_ADVANCE_RATIO) {
  for (const step of FONT_SIZE_STEPS) {
    const fontSizeMm = baseFontSizeMm * step;

    if (textWidthMm(text, fontSizeMm, advanceRatio) <= widthMm) {
      return { fontSizeMm, step, fits: true };
    }
  }

  const lastStep = FONT_SIZE_STEPS[FONT_SIZE_STEPS.length - 1];

  return { fontSizeMm: baseFontSizeMm * lastStep, step: lastStep, fits: false };
}

/** O preco desce de corpo e nunca e cortado. */
export function fitPriceText(formattedPrice, zone) {
  const text = typeof formattedPrice === 'string' ? formattedPrice : '';
  const { fontSizeMm, step, fits } = fitFontSizeMm(text, zone.widthMm, zone.fontSizeMm);

  return { text, fontSizeMm, step, fits };
}

/**
 * O codigo numerico desce pelos mesmos degraus e so e cortado abaixo do ultimo,
 * porque codigo cortado deixa de bater com o que o simbolo devolve.
 */
export function fitCodeText(systemCode, zone) {
  const text = typeof systemCode === 'string' ? systemCode : '';
  const { fontSizeMm, step, fits } = fitFontSizeMm(text, zone.widthMm, zone.fontSizeMm);

  if (fits) {
    return { text, fontSizeMm, step, truncated: false };
  }

  const budget = charBudget(zone.widthMm, fontSizeMm, DIGIT_ADVANCE_RATIO);

  return { text: cutWithEllipsis(text, budget), fontSizeMm, step, truncated: true };
}

/**
 * Avanco medio de texto corrido em caixa baixa e peso normal. A media geral
 * serve ao nome, que mistura caixa alta; a linha de apoio e quase toda em caixa
 * baixa, e com a media geral ela seria cortada com folga sobrando.
 */
export const LOWERCASE_ADVANCE_RATIO = 0.5;

/**
 * Texto de uma linha so, cortado com reticencias quando passa da largura. Vale
 * para o que e apoio na etiqueta — a empresa, o parcelamento, a linha fiscal —
 * e que continua servindo pela metade. A estimativa e a primeira guarda; a tela
 * recorta a zona e o arquivo impresso mede a largura real, como no nome.
 */
export function fitSingleLine(text, zone, advanceRatio = LOWERCASE_ADVANCE_RATIO) {
  const value = typeof text === 'string' ? text.trim() : '';
  const budget = charBudget(zone.widthMm, zone.fontSizeMm, advanceRatio);

  if (value.length <= budget) {
    return { text: value, truncated: false };
  }

  return { text: cutWithEllipsis(value, budget), truncated: true };
}
