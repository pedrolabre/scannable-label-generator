/**
 * Gravacao do arquivo de backup ja conferido.
 *
 * ## Substituir, e nao mesclar
 *
 * O arquivo e o retrato de um armazenamento inteiro, e restaurar e reconstruir
 * esse armazenamento. Mesclar produziria um terceiro estado que nao existe nem
 * no arquivo nem no dispositivo, e a promessa de reconstruir o ambiente em outro
 * aparelho seria falsa sempre que o aparelho de destino tivesse qualquer coisa
 * gravada. Acrescentar ao catalogo, decidindo caso a caso o que fazer com codigo
 * repetido, ja e o que a importacao em lote faz; esta e outra intencao.
 *
 * A consequencia e direta e precisa ser dita ao operador antes, com todas as
 * letras: o que estava gravado sai, inclusive o produto que nao esta no arquivo.
 *
 * ## Uma transacao so, e nao fatias
 *
 * A importacao em lote grava em fatias porque precisa ceder o turno para
 * informar progresso, e transacao que cede o turno fecha sozinha. Aqui nao ha o
 * que informar no meio: a restauracao nao e interrompivel por decisao, porque
 * parar no meio e exatamente o estado corrompido que o bloco existe para evitar.
 *
 * Em transacao unica, uma falha no meio desfaz tudo o que ela tinha feito, e o
 * conteudo anterior continua exatamente como estava. E a resposta mais forte
 * possivel a promessa de nao corromper nada, e ela so e possivel porque o
 * arquivo inteiro foi conferido antes de a transacao abrir.
 *
 * ## O que este modulo nao conhece
 *
 * A biblioteca de persistencia. O repositorio entra como dependencia, e nao como
 * import, pela mesma razao que vale para a gravacao do lote: dominio nao importa
 * armazenamento, e a suite consegue exercitar a sequencia inteira num ambiente
 * sem IndexedDB.
 */

/**
 * Restaura o ambiente a partir de um arquivo ja conferido.
 *
 * Nao confere nada de novo: receber aqui um arquivo que nao passou pela leitura
 * seria um erro de chamada, nao um caso de uso. O erro do armazenamento sobe
 * como veio — a traducao para o texto que o usuario le acontece onde ele le.
 */
export async function restoreBackup(file, { repository }) {
  const products = file.tables.products;

  await repository.replaceAllProducts(products);

  return { restoredProducts: products.length };
}
