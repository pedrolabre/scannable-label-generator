import { db } from './indexed-db.js';
import { listProducts, replaceAllProducts } from './productRepository.js';

/**
 * As quatro tabelas do armazenamento local vistas como um conjunto, que e como
 * o arquivo de backup precisa ve-las.
 *
 * A tabela de produtos **nao** e alcancada daqui: ela continua tendo um caminho
 * unico, e este modulo delega a ele tanto a leitura quanto a gravacao. Tocar
 * `db.products` aqui criaria a segunda porta que o repositorio de produtos
 * existe para nao ter, e a gravacao escaparia do contrato.
 *
 * As outras tres tabelas sao lidas direto porque nao tem repositorio: ninguem
 * escreve nelas. Os dois catalogos sao constante de codigo e o trabalho de
 * impressao e transiente, entao a leitura existe para confirmar que estao vazias
 * — e nao para migrar conteudo que a aplicacao nao produz.
 */

/** Le as quatro tabelas de uma vez, para montar o arquivo de backup. */
export async function readBackupTables() {
  const [products, labelLayouts, sheetLayouts, printJobs] = await Promise.all([
    listProducts(),
    db.labelLayouts.toArray(),
    db.sheetLayouts.toArray(),
    db.printJobs.toArray(),
  ]);

  return { products, labelLayouts, sheetLayouts, printJobs };
}

/**
 * Grava o conteudo de um arquivo ja conferido. Hoje so a tabela de produtos tem
 * o que receber; as outras tres chegam vazias por contrato do proprio arquivo.
 */
export function writeBackupTables(tables) {
  return replaceAllProducts(tables.products);
}
