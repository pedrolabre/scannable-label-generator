import { Database, Download, Plus } from 'lucide-react';

import { APP_NAME } from '../lib/app-meta.js';

import { SHELL_VIEWS } from './AppShell.jsx';
import Button from './ui/Button.jsx';
import SegmentedControl from './ui/SegmentedControl.jsx';

const VIEW_OPTIONS = [
  { value: SHELL_VIEWS.PRINT, label: 'Impressão' },
  { value: SHELL_VIEWS.PRODUCTS, label: 'Produtos' },
  { value: SHELL_VIEWS.PREVIEW, label: 'Prévia' },
];

/**
 * Faixa do topo: a marca e os tres gatilhos que nao pertencem a coluna nenhuma.
 *
 * Cadastrar, importar e gerar o arquivo de backup nao sao passo do trabalho de
 * impressao nem da listagem — sao tarefas que atravessam a aplicacao inteira.
 * Por isso ficam aqui, e nao dentro de uma das colunas, que e onde estariam se
 * a pergunta fosse so "onde cabe".
 *
 * `Novo produto` e o unico botao de marca da tela principal. Dois botoes
 * preenchidos lado a lado deixariam de indicar qualquer coisa.
 *
 * A marca e o grupo de botoes dividem a linha sem se cobrir, em qualquer
 * largura. Os botoes nunca encolhem, e quem cede e a marca: o nome termina em
 * reticencias antes de ficar por baixo de um botao. Em janela de telefone o
 * texto dos botoes sai da vista e fica so para leitor de tela; o icone e o
 * nome acessivel continuam os mesmos.
 *
 * Abaixo do ponto de corte a faixa ganha uma segunda linha, a barra de vistas,
 * que escolhe qual das tres colunas ocupa a tela. Na tela larga as tres estao
 * sempre a vista e a barra nao existe.
 *
 * Nada explica do que a aplicacao trata. O nome e o desenho da marca ja o
 * dizem, e a tela inteira e a resposta: uma linha de apoio no topo so seria
 * lida uma vez, e depois ficaria ocupando lugar em toda abertura.
 */
export default function AppHeader({
  onNewProduct,
  onImport,
  onBackup,
  activeView = SHELL_VIEWS.PRODUCTS,
  onViewChange,
}) {
  return (
    <header className="flex flex-none flex-col border-b border-neutro-borda bg-neutro-branco">
      <div className="flex h-topo min-w-0 items-center justify-between gap-4 px-recuo">
        <div data-marca="" className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-marca-vermelho text-neutro-branco"
          >
            <BrandMark />
          </span>

          <h1 className="min-w-0 truncate font-display text-xl font-bold tracking-[-0.015em] text-neutro-tinta lg:text-lg">
            {APP_NAME}
          </h1>
        </div>

        <div data-gatilhos="" className="flex flex-none items-center gap-2">
          <Button type="button" onClick={onImport} className="max-sm:px-3">
            <Download className="h-4 w-4 lg:h-[15px] lg:w-[15px]" aria-hidden="true" />
            <span className="max-sm:sr-only">Importar</span>
          </Button>

          <Button type="button" onClick={onBackup} className="max-sm:px-3">
            <Database className="h-4 w-4 lg:h-[15px] lg:w-[15px]" aria-hidden="true" />
            <span className="max-sm:sr-only">Backup</span>
          </Button>

          <Button type="button" variant="primary" onClick={onNewProduct} className="max-sm:px-3">
            <Plus className="h-4 w-4 lg:h-[15px] lg:w-[15px]" aria-hidden="true" />
            <span className="max-sm:sr-only">Novo produto</span>
          </Button>
        </div>
      </div>

      <nav aria-label="Vistas" data-barra-vistas="" className="px-recuo pb-3 lg:hidden">
        <SegmentedControl
          legend="Vista"
          name="vista"
          options={VIEW_OPTIONS}
          value={activeView}
          onChange={onViewChange}
          stretch
          hideLegend
        />
      </nav>
    </header>
  );
}

/**
 * Desenho da marca: quatro modulos, tres deles no canto, como um simbolo 2D
 * comeca. Ele e escrito aqui, e nao carregado da biblioteca de icones, porque e
 * a unica forma que nao pertence ao vocabulario de icones — e porque com canto
 * reto em todo o produto ele nao pode ter `rx`.
 */
function BrandMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5" height="5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="9.5" y="1.5" width="5" height="5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="1.5" y="9.5" width="5" height="5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="9.5" y="9.5" width="2" height="2" fill="currentColor" />
      <rect x="12.5" y="12.5" width="2" height="2" fill="currentColor" />
    </svg>
  );
}
