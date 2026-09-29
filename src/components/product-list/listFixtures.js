/**
 * Catalogo inventado para os testes da listagem, do ramo de moveis e
 * eletrodomesticos. O nome junta um tipo, um detalhe e um numero de cinco
 * digitos, e alguns tipos levam acento, para a busca sem acento ter o que
 * provar. O identificador tem a forma de um UUID e sai do indice, entao a mesma
 * chamada devolve sempre o mesmo catalogo.
 */

const TIPOS = [
  'Sofá retrátil',
  'Geladeira frost free',
  'Guarda-roupa seis portas',
  'Fogão cinco bocas',
  'Colchão casal',
  'Cômoda com espelho',
  'Rack para TV',
  'Lavadora 12 kg',
  'Aparador de madeira',
  'Ventilador de coluna',
];

const CATEGORIAS = ['Móveis', 'Eletrodomésticos', 'Colchões'];

function hex(value, size) {
  return value.toString(16).padStart(size, '0');
}

export function inventProduct(index) {
  const number = String(index + 1).padStart(5, '0');

  return {
    id: `${hex(index, 8)}-0000-4000-8000-${hex(index * 7919, 12)}`,
    systemCode: String(100000 + index),
    displayName: `${TIPOS[index % TIPOS.length]} ${number}`,
    priceInCentavos: 19990 + ((index * 3779) % 899000),
    category: CATEGORIAS[index % CATEGORIAS.length],
    ean: index % 5 === 0 ? `789${String(1000000000 + index).slice(-10)}` : undefined,
    createdAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
  };
}

export function inventCatalog(total, offset = 0) {
  return Array.from({ length: total }, (_, index) => inventProduct(index + offset));
}
