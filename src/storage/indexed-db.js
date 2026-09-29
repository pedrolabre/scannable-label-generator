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
 *
 * A versao 2 acrescenta `referenceEntries`, a base de referencia com o NCM e o
 * codigo de barras de cada codigo da planilha cadastral. Ela e separada do
 * catalogo: nenhuma linha dela vira produto. A chave primaria e o codigo
 * comparavel (so digitos, sem zeros a esquerda), para que `01620` e `1620`
 * cheguem a mesma linha. As quatro tabelas da versao 1 seguem com os mesmos
 * indices, e o banco que ja existe na versao 1 abre na versao 2 sem perder
 * nenhum registro: a mudanca so cria a tabela nova.
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

    this.version(2).stores({
      products: 'id, systemCode, ean',
      labelLayouts: 'id',
      sheetLayouts: 'id',
      printJobs: 'id, createdAt',
      referenceEntries: 'comparableCode',
    });
  }
}

export const db = new LabelForgeDatabase();
