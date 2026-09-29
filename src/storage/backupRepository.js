import { listProducts, replaceAllProducts } from './productRepository.js';

/**
 * O armazenamento local visto como o arquivo de backup precisa ve-lo.
 *
 * O arquivo leva so a tabela de produtos, e ela **nao** e alcancada daqui: ela
 * continua tendo um caminho unico, e este modulo delega a ele tanto a leitura
 * quanto a gravacao. Tocar a tabela direto aqui criaria a segunda porta que o
 * repositorio de produtos existe para nao ter, e a gravacao escaparia do
 * contrato.
 *
 * A base de referencia fica fora do arquivo: ela se refaz inteira a partir da
 * planilha cadastral, e a restauracao nao a apaga nem a substitui.
 */

/** Le o que o arquivo de backup leva. */
export async function readBackupTables() {
  const products = await listProducts();

  return { products };
}

/**
 * Grava o conteudo de um arquivo ja conferido. So a tabela de produtos tem o
 * que receber: num arquivo do formato anterior, as outras tres tabelas chegam
 * vazias por contrato do proprio arquivo.
 */
export function writeBackupTables(tables) {
  return replaceAllProducts(tables.products);
}
