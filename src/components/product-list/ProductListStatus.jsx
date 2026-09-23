import { AlertTriangle, Loader2, PackageOpen, SearchX } from 'lucide-react';

import Button from '../ui/Button.jsx';

/**
 * Os quatro estados em que a listagem nao tem linhas para mostrar. Cada um diz
 * o que esta acontecendo e, quando ha uma saida, oferece a acao que resolve.
 */
function StatusBlock({ icon: Icon, iconClassName, title, children }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Icon className={iconClassName ?? 'h-8 w-8 text-neutro-bordaForte'} aria-hidden="true" />

      <div className="space-y-1">
        <p className="text-sm font-semibold text-neutro-tintaMedia">{title}</p>
        <div className="text-sm text-neutro-tintaFraca">{children}</div>
      </div>
    </div>
  );
}

export function LoadingStatus() {
  return (
    <StatusBlock
      icon={Loader2}
      iconClassName="h-8 w-8 animate-spin text-neutro-bordaForte"
      title="Carregando produtos"
    >
      <p role="status">Lendo o que está salvo neste dispositivo.</p>
    </StatusBlock>
  );
}

export function EmptyCatalogStatus() {
  return (
    <StatusBlock icon={PackageOpen} title="Nenhum produto cadastrado">
      <p>Use o formulário acima para cadastrar o primeiro produto.</p>
    </StatusBlock>
  );
}

export function NoMatchStatus({ query, onClearSearch }) {
  return (
    <StatusBlock icon={SearchX} title="Nenhum produto encontrado">
      <p>
        Nada corresponde a <span className="font-semibold">{query}</span> no nome nem nos códigos.
      </p>
      <Button type="button" onClick={onClearSearch} className="mt-3">
        Limpar busca
      </Button>
    </StatusBlock>
  );
}

/**
 * Distingue a leitura que falhou de um catalogo realmente vazio. Sem este
 * estado as duas situacoes apareceriam como a mesma tela, e o usuario seria
 * convidado a cadastrar um produto num armazenamento que nao respondeu.
 */
export function LoadFailureStatus({ message, onRetry }) {
  return (
    <StatusBlock
      icon={AlertTriangle}
      iconClassName="h-8 w-8 text-marca-vermelhoTexto"
      title="Falha ao ler os produtos salvos"
    >
      <p role="alert">{message}</p>
      <Button type="button" onClick={onRetry} className="mt-3">
        Tentar de novo
      </Button>
    </StatusBlock>
  );
}
