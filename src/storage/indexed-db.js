import Dexie from 'dexie';

export const DATABASE_NAME = 'LabelForgeDB';

/**
 * Banco local da aplicacao. A primeira chave de cada tabela e a chave primaria;
 * as demais sao indices secundarios de busca.
 *
 * Em `products`, `systemCode` atende a busca pelo codigo interno da empresa e
 * `ean` atende a busca pelo codigo de barras do fabricante. Os dois sao indices
 * simples, nao unicos: produto sem `ean` continua gravavel, e codigo repetido e
 * tratado como conflito a resolver, nao como erro de escrita.
 */
export class LabelForgeDatabase extends Dexie {
  constructor(name = DATABASE_NAME) {
    super(name);

    this.version(1).stores({
      products: 'id, systemCode, ean',
      labelLayouts: 'id',
      sheetLayouts: 'id',
      printJobs: 'id, createdAt',
    });
  }
}

export const db = new LabelForgeDatabase();
