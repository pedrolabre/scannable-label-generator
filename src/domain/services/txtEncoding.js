/**
 * Decodificacao dos relatorios em texto do ERP.
 *
 * Esses relatorios nao sao UTF-8 e nao seguem uma codificacao so. O cabecalho
 * e a maior parte das descricoes estao em Latin-1 ("Preço", "Fogão", "BALCÃO"),
 * mas parte das descricoes foi digitada num terminal de pagina de codigo 850,
 * e os bytes dela aparecem misturados no mesmo arquivo: `80` e o "Ç" de "AÇO",
 * `90` o "É" de "MÉDIO", `A7` o "º" de "Nº 12". Lidos em Latin-1 ou em
 * Windows-1252, esses bytes viram controle invisivel, "€" ou "§".
 *
 * A leitura aqui e mista, byte a byte: os bytes de `80` a `9F`, que em Latin-1
 * so tem controle, e os tres bytes altos que so fazem sentido em CP850 nesses
 * relatorios (`A7`, `D6` e `F8`) seguem a pagina 850; todo o resto segue o
 * Latin-1, em que o byte e o proprio ponto de codigo.
 *
 * A tabela e escrita aqui, sem `TextDecoder`: a pagina 850 nao existe no
 * padrao de codificacao dos navegadores, e o rotulo "latin1" nao decodifica
 * igual em todo ambiente (o padrao manda ler Windows-1252; ha ambientes que
 * leem Latin-1 puro). Com a tabela propria, o mesmo arquivo da o mesmo texto
 * em qualquer lugar.
 */

/**
 * Bytes lidos pela pagina 850, com o caractere de cada um. De `80` a `9F` e a
 * faixa inteira da pagina; os tres ultimos sao os bytes altos que so aparecem
 * nesses relatorios com o sentido da 850.
 */
const CP850_OVERRIDES = [
  [0x80, 'Ç'],
  [0x81, 'ü'],
  [0x82, 'é'],
  [0x83, 'â'],
  [0x84, 'ä'],
  [0x85, 'à'],
  [0x86, 'å'],
  [0x87, 'ç'],
  [0x88, 'ê'],
  [0x89, 'ë'],
  [0x8a, 'è'],
  [0x8b, 'ï'],
  [0x8c, 'î'],
  [0x8d, 'ì'],
  [0x8e, 'Ä'],
  [0x8f, 'Å'],
  [0x90, 'É'],
  [0x91, 'æ'],
  [0x92, 'Æ'],
  [0x93, 'ô'],
  [0x94, 'ö'],
  [0x95, 'ò'],
  [0x96, 'û'],
  [0x97, 'ù'],
  [0x98, 'ÿ'],
  [0x99, 'Ö'],
  [0x9a, 'Ü'],
  [0x9b, 'ø'],
  [0x9c, '£'],
  [0x9d, 'Ø'],
  [0x9e, '×'],
  [0x9f, 'ƒ'],
  [0xa7, 'º'],
  [0xd6, 'Í'],
  [0xf8, '°'],
];

/**
 * Ponto de codigo de cada um dos 256 bytes. Todos cabem em 16 bits, entao o
 * texto sai direto da tabela, sem par substituto.
 */
const CODE_POINT_BY_BYTE = (() => {
  const table = new Uint16Array(256);

  for (let byte = 0; byte < 256; byte += 1) {
    table[byte] = byte;
  }

  for (const [byte, character] of CP850_OVERRIDES) {
    table[byte] = character.charCodeAt(0);
  }

  return table;
})();

/**
 * Tamanho de cada fatia passada de uma vez para `String.fromCharCode`: o
 * relatorio inteiro de uma vez passaria do limite de argumentos de uma chamada.
 */
const CHUNK_LENGTH = 8192;

export function decodeReportBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const parts = [];

  for (let start = 0; start < bytes.length; start += CHUNK_LENGTH) {
    const end = Math.min(start + CHUNK_LENGTH, bytes.length);
    const codes = new Uint16Array(end - start);

    for (let i = start; i < end; i += 1) {
      codes[i - start] = CODE_POINT_BY_BYTE[bytes[i]];
    }

    parts.push(String.fromCharCode.apply(null, codes));
  }

  return parts.join('');
}
