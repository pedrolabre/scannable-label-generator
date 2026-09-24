import { RefreshCw } from 'lucide-react';
import { useCallback, useSyncExternalStore } from 'react';

import { APP_NAME } from '../../lib/app-meta.js';
import {
  applyPendingUpdate,
  getUpdateSnapshot,
  subscribeToUpdate,
} from '../../pwa/updateState.js';

import Button from '../ui/Button.jsx';

/**
 * Aviso de versao nova.
 *
 * Ele flutua acima da linha de estado, a direita, em vez de ocupar uma faixa no
 * fluxo: nao ha mais fluxo onde entrar. Com a aplicacao presa a altura da
 * janela, um aviso que empurrasse o conteudo encolheria as tres colunas por
 * causa de uma informacao que o operador atende quando quiser.
 *
 * Nao usa o `InlineAlert` de proposito: aquele carrega a cor de erro e a
 * semantica de falha, e aqui nao houve erro nem acao do operador que tenha
 * falhado. O que ha e uma informacao com uma acao opcional ao lado.
 *
 * O componente nao guarda estado proprio: le o sinalizador do modulo de
 * atualizacao e some sozinho quando a troca e aplicada.
 */
export default function UpdateNotice() {
  const updateAvailable = useSyncExternalStore(
    subscribeToUpdate,
    getUpdateSnapshot,
    getUpdateSnapshot,
  );

  const handleUpdate = useCallback(() => {
    applyPendingUpdate();
  }, []);

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-16 right-6 z-40 w-[22rem] max-w-[calc(100vw-3rem)] border border-neutro-borda bg-neutro-branco p-4 shadow-modal">
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-neutro-tintaFraca" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold">Uma nova versão do {APP_NAME} está disponível.</p>
          <p className="text-sm leading-relaxed text-neutro-tintaMedia">
            A folha em preparo não é mantida ao recarregar. Atualize quando terminar o que está
            fazendo.
          </p>
        </div>
      </div>

      <Button variant="secondary" onClick={handleUpdate} className="mt-3 w-full">
        Atualizar agora
      </Button>
    </div>
  );
}
