import { cx } from '../../lib/cx.js';

/**
 * Unica forma de criar regiao que rola na vertical.
 *
 * Ela encapsula o par que faz isso funcionar dentro de flex e que e a origem de
 * metade dos defeitos de layout nesse tipo de tela: o `min-height: 0` no
 * elemento intermediario, sem o qual o `overflow-y` do corpo nao vale, porque
 * um item de flex nao encolhe abaixo do proprio conteudo por padrao. Ele esta
 * aqui dentro para nao depender de quem monta a tela lembrar dele.
 *
 *     <section>                      flex column, min-height: 0
 *       <header>                     flex: 0 0 auto
 *       <div data-corpo>             flex: 1 1 auto, min-height: 0, overflow-y: auto
 *       <footer>                     flex: 0 0 auto   (opcional)
 *     </section>
 *
 * A tela principal tem exatamente tres destas, e nenhuma esta dentro de outra.
 * Qualquer quarta e defeito, nao decisao de quem escreve o componente.
 *
 * A area que rola na horizontal, usada pelas duas superficies que saem em
 * milimetro real, e outra coisa e vive dentro do corpo de uma destas.
 *
 * O cabecalho tem duas formas. Na comum, `title` e o texto visivel e `actions`
 * o acompanha na mesma linha. Quando a regiao precisa de mais do que um titulo
 * — a listagem tem busca, filtro e a faixa de colunas da tabela —, `header`
 * substitui o conjunto e recebe o desenho inteiro, ja sem recuo lateral, para
 * que uma faixa possa encostar nas bordas.
 *
 * `label` nomeia a regiao para quem usa leitor de tela, e cai no proprio titulo
 * quando nao e informado. Com `header`, ele e obrigatorio: nao ha titulo de
 * onde tirar o nome.
 *
 * `header={null}` e diferente de nao informar `header`: e a regiao que declara
 * nao ter faixa fixa nenhuma, e nao a que aceita a faixa padrao.
 *
 * O recuo do corpo e o mesmo nas tres colunas e acompanha a densidade da tela.
 * `bodyClassName` acrescenta ao recuo o arranjo do conteudo; `flush` tira o
 * recuo, para o corpo que encosta nas bordas, como a tabela da listagem.
 *
 * A regiao ocupa a altura inteira de quem a recebe. Na tela estreita ela vive
 * dentro de uma vista, e nao direto na grade, e sem isso o corpo nao teria
 * altura de onde rolar.
 */
export default function ShellColumn({
  title,
  label,
  actions,
  header = undefined,
  footer,
  className,
  bodyClassName,
  flush = false,
  children,
  ...rest
}) {
  return (
    <section
      aria-label={label ?? title}
      className={cx('flex min-h-0 min-w-0 flex-1 flex-col', className)}
      {...rest}
    >
      <div className="flex-none">
        {header === undefined ? (
          <div className="flex items-center justify-between gap-3 px-recuo pb-1 pt-4 lg:pt-3">
            <h2 className="font-display text-xs font-semibold uppercase tracking-[0.09em] text-neutro-tintaFraca">
              {title}
            </h2>
            {actions}
          </div>
        ) : (
          header
        )}
      </div>

      <div
        data-corpo=""
        className={cx(
          'min-h-0 flex-1 overflow-y-auto',
          flush ? null : 'px-recuo pb-recuo pt-3',
          bodyClassName,
        )}
      >
        {children}
      </div>

      {footer ? (
        <div className="flex flex-none flex-col gap-2 border-t border-neutro-borda px-recuo py-3">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
