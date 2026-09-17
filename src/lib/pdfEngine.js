/**
 * Unico ponto do projeto que nomeia a biblioteca de PDF.
 *
 * O isolamento serve a duas coisas. A primeira e trocar a biblioteca um dia
 * sem varrer a base atras do nome dela: quem escreve o documento fala com o
 * adaptador, e o adaptador fala com este arquivo. A segunda e o tamanho: este
 * modulo e carregado sob demanda por `pdf.js`, entao o empacotador o separa num
 * arquivo proprio e quem abre o cadastro de produtos nao paga por ele.
 */

import { jsPDF } from 'jspdf';

export { jsPDF };
