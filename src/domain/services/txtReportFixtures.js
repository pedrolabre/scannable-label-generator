/**
 * Relatorios em texto montados para os testes, no mesmo leiaute dos relatorios
 * do ERP, com loja, endereco, telefone e usuario inventados. O texto usa
 * escapes de `\x00` a `\xFF` para os bytes do arquivo: `\xe7` e o "ç" do
 * cabecalho em Latin-1, `\x80` o "Ç" da pagina 850.
 */

export const PRICE_RULER =
  '+------+-----------------------------------+----------+---------+---+---------+';
export const STOCK_RULER =
  '+------+---------------+-----------------------------------------------------------+---+----------+----------+----------+-----+';

export function priceHeader(page) {
  return [
    '='.repeat(100),
    `Data: 01/02/2030                  * Tabela de Pre\xe7o *                    Pag: ${String(page).padStart(4, '0')}`,
    'Hora: 09:00:00                 LOJA FICTICIA DE TESTE',
    '                     RUA INVENTADA 0 CENTRO CIDADE FICTICIA/XX',
    'Pre\xe7o: Varejo                  ** Fones: (000)0000-0000  **          Categoria: Todas',
    PRICE_RULER,
    '|Codigo|Descricao                          |Marca     |Estoque  |UN |Pre\xe7o R$ |',
    PRICE_RULER,
    'Somente: Loja: 1-LOJA FICTICIA',
  ];
}

export function stockHeader(page) {
  return [
    '='.repeat(100),
    `Data: 01/02/2030                               **  Saldo de Estoque por Grupo **                                      Pag: ${String(page).padStart(4, '0')}`,
    'Hora: 09:00:00                                   LOJA FICTICIA DE TESTE',
    '                               RUA INVENTADA 0 CENTRO CIDADE FICTICIA/XX',
    '                                                 ** Fones: (000)0000-0000  **                                  Categoria: Todas',
    STOCK_RULER,
    '|Codigo|Alternativo                                                                      Est. Loja',
    STOCK_RULER,
    'Somente: Loja: 1-LOJA FICTICIA',
  ];
}

export function footer(count) {
  return [
    '='.repeat(79),
    `www.sistema-ficticio.test          Usu\xe1rio: OPERADOR INVENTADO Registros: ${count}`,
  ];
}

export const PAGE_GAP = ['', '', '', '', '', ''];

/**
 * Linha de registro: um espaco antes da primeira coluna e um entre as outras,
 * com largura positiva para texto alinhado a esquerda e negativa para numero
 * alinhado a direita.
 */
function row(widths, values) {
  const cells = values.map((value, i) =>
    widths[i] > 0 ? value.padEnd(widths[i]) : value.padStart(-widths[i]),
  );

  return ' ' + cells.join(' ');
}

export function priceRow({
  code,
  description,
  brand = 'GERAL_____',
  stock = '1,00',
  unit = 'UN',
  price = '10,00',
}) {
  return row([6, 35, 10, -9, 3, -9], [code, description, brand, stock, unit, price]);
}

export function stockRow({
  code,
  alternative = '100.1',
  description,
  unit = 'UN',
  stock = '1,00',
  first = '',
  second = '',
}) {
  return row(
    [6, 15, 59, 3, -10, 10, 10, 5],
    [code, alternative, description, unit, stock, first, second, '_____'],
  );
}

export function bytesOf(lines, newline = '\r\n') {
  const text = lines.join(newline) + newline;

  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}
