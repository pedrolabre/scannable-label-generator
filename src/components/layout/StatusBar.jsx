/**
 * Faixa de leitura ao pe da tela: o que existe no banco e o que esta marcado
 * para a folha.
 *
 * Ela nao tem acao nenhuma, e isso e a decisao, nao um detalhe: o rodape da
 * pagina antiga foi virando a gaveta das sobras — o botao que nao tinha dono,
 * o aviso que nao tinha lugar. Uma faixa que so informa nao tem como receber a
 * proxima sobra.
 *
 * Ela diz numero, e so numero. O aviso de que o conteudo fica no proprio
 * dispositivo saiu daqui: repetido em toda tela, todo dia, ele deixava de ser
 * informacao e passava a ser ruido. Quem precisa dele encontra o assunto onde
 * ele importa, que e a janela do arquivo de backup.
 *
 * Falta a contagem de folhas. Ela nao e um numero que a tela tenha: sai da
 * grade calculada sobre o modelo de etiqueta e o de folha, dentro da coluna da
 * esquerda. Traze-la ate aqui pede que esse calculo suba junto — e e isso que a
 * reparticao da coluna de impressao faz. Ate la, a faixa prefere nao dizer a
 * repetir mal o que a coluna ja diz bem.
 */

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export default function StatusBar({ productCount = 0, selectedCount = 0 }) {
  return (
    <footer className="flex h-12 flex-none items-center gap-4 border-t border-neutro-borda bg-neutro-branco px-6 text-xs text-neutro-tintaFraca">
      <div className="flex min-w-0 items-center gap-4">
        <span className="truncate">{plural(productCount, 'produto', 'produtos')} no banco</span>
        <span aria-hidden="true" className="text-neutro-bordaForte">
          ·
        </span>
        <span className="truncate">{selectedCount} selecionados</span>
      </div>
    </footer>
  );
}
