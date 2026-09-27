import { decodeReportBytes } from './txtEncoding.js';

/**
 * Conserto do texto que chegou a planilha lido na pagina de codigo errada.
 *
 * O `content.xml` de uma planilha e sempre UTF-8, mas o texto dentro dele pode
 * ter sido convertido errado antes de chegar la. Nas planilhas exportadas do
 * ERP, parte das descricoes foi gravada em Latin-1 e lida como pagina de
 * codigo 850 na exportacao: o "ã" virou "Ò", o "á" virou "ß", o "Ã" virou "├"
 * e o "Á" virou "┴" ("FogÒo a gßs", "BALC├O"). As descricoes digitadas num
 * terminal de pagina 850 passaram pela mesma leitura e sairam certas — por
 * isso "AÇO" e "Nº" ja chegam acentuados.
 *
 * O conserto desfaz essa leitura: cada caractere volta ao byte que tinha na
 * pagina 850 e o byte e lido pela mesma tabela mista dos relatorios em texto
 * (`txtEncoding.js`). O "Ç" e o "º" voltam aos bytes `80` e `A7`, que a tabela
 * le de novo como "Ç" e "º", e o ASCII nao muda. O espaco sem quebra fica como
 * esta: na pagina 850 ele e o byte `FF`, que em Latin-1 seria "ÿ".
 *
 * O conserto so vale para o arquivo inteiro e so quando o arquivo tem algum
 * caractere de moldura de tela (`┴├═╔║`), que texto de produto nao usa e que so
 * aparece nessa leitura errada. Uma planilha com os acentos certos nao tem
 * esses caracteres e passa sem nenhuma troca; numa planilha com eles, um "á"
 * escrito certo tambem seria trocado, porque nao ha como distinguir um do
 * outro caractere a caractere.
 */

/** Caracteres de `80` a `FF` na pagina 850, na ordem dos bytes. */
const CP850_HIGH_HALF =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒ' +
  'áíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐' +
  '└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀' +
  'ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';

const NO_BREAK_SPACE = ' ';

const FRAME_CHARACTERS = /[┴├═╔║]/;

/**
 * Troca de cada caractere da metade alta da pagina 850 pelo que o byte dele
 * da na tabela mista. So entram as trocas que mudam alguma coisa.
 */
const REPAIR_BY_CHARACTER = (() => {
  const repairs = new Map();

  [...CP850_HIGH_HALF].forEach((character, position) => {
    if (character === NO_BREAK_SPACE) {
      return;
    }

    const repaired = decodeReportBytes(Uint8Array.of(0x80 + position));

    if (repaired !== character) {
      repairs.set(character, repaired);
    }
  });

  return repairs;
})();

const REPAIRABLE = new RegExp(`[${[...REPAIR_BY_CHARACTER.keys()].join('')}]`, 'g');

export function hasCp850Misreading(text) {
  return FRAME_CHARACTERS.test(text);
}

export function repairCp850Misreading(text) {
  return text.replace(REPAIRABLE, (character) => REPAIR_BY_CHARACTER.get(character));
}
