import { RefreshCw } from 'lucide-react';
import { useCallback, useSyncExternalStore } from 'react';

import { APP_NAME } from '../../lib/app-meta.js';
import {
  applyPendingUpdate,
  getUpdateSnapshot,
  subscribeToUpdate,
} from '../../pwa/updateState.js';

import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

/**
 * Aviso de versao nova, no topo da pagina.
 *
 * Nao usa o `InlineAlert` de proposito: aquele carrega a cor de perigo e a
 * semantica de erro, e aqui nao houve erro nem acao do operador que tenha
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
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-4">
        <RefreshCw
          className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400"
          aria-hidden="true"
        />
        <div className="min-w-[16rem] flex-1 space-y-1">
          <p className="text-sm font-semibold">
            Uma nova versão do {APP_NAME} está disponível.
          </p>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            A folha em preparo não é mantida ao recarregar. Atualize quando terminar o que está
            fazendo.
          </p>
        </div>
        <Button variant="secondary" onClick={handleUpdate}>
          Atualizar agora
        </Button>
      </div>
    </Card>
  );
}
