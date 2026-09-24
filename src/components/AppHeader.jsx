import { Database, Download, Plus } from 'lucide-react';

import { APP_NAME } from '../lib/app-meta.js';

import Button from './ui/Button.jsx';

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
 * Nada explica do que a aplicacao trata. O nome e o desenho da marca ja o
 * dizem, e a tela inteira e a resposta: uma linha de apoio no topo so seria
 * lida uma vez, e depois ficaria ocupando lugar em toda abertura.
 */
export default function AppHeader({ onNewProduct, onImport, onBackup }) {
  return (
    <header className="flex h-16 flex-none items-center justify-between gap-6 border-b border-neutro-borda bg-neutro-branco px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded bg-marca-vermelho text-neutro-branco"
        >
          <BrandMark />
        </span>

        <h1 className="font-display text-xl font-bold tracking-[-0.015em] text-neutro-tinta">
          {APP_NAME}
        </h1>
      </div>

      <div className="flex flex-none items-center gap-2">
        <Button type="button" onClick={onImport}>
          <Download className="h-[15px] w-[15px]" aria-hidden="true" />
          Importar
        </Button>

        <Button type="button" onClick={onBackup}>
          <Database className="h-[15px] w-[15px]" aria-hidden="true" />
          Backup
        </Button>

        <Button type="button" variant="primary" onClick={onNewProduct}>
          <Plus className="h-[15px] w-[15px]" aria-hidden="true" />
          Novo produto
        </Button>
      </div>
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
