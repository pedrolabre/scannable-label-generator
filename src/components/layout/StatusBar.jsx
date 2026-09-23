/**
 * Faixa de leitura ao pe da tela: o que existe no banco, o que esta marcado
 * para a folha e quantas folhas isso ocupa.
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
 * A contagem de folhas chega pronta, da mesma leitura do trabalho que a coluna
 * da esquerda e o dialogo da folha usam. Enquanto o trabalho nao vale, ela e
 * zero: a faixa nao repete a ultima conta que valeu.
 */

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function Separator() {
  return (
    <span aria-hidden="true" className="text-neutro-bordaForte">
      ·
    </span>
  );
}

export default function StatusBar({ productCount = 0, selectedCount = 0, sheetCount = 0 }) {
  return (
    <footer className="flex h-estado flex-none items-center gap-4 border-t border-neutro-borda bg-neutro-branco px-recuo text-xs text-neutro-tintaFraca">
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate" data-status-products={productCount}>
          {plural(productCount, 'produto', 'produtos')} no banco
        </span>
        <Separator />
        <span className="truncate" data-status-selected={selectedCount}>
          {plural(selectedCount, 'selecionado', 'selecionados')}
        </span>
        <Separator />
        <span className="truncate" data-status-sheets={sheetCount}>
          {plural(sheetCount, 'folha', 'folhas')}
        </span>
      </div>
    </footer>
  );
}
