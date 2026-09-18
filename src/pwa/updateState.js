/**
 * Estado da atualizacao da aplicacao instalada, fora do React.
 *
 * Quem descobre que ha versao nova e o registro do service worker, que roda no
 * ponto de entrada e nao pode ser montado dentro de componente. Este modulo e a
 * ponte: guarda um sinalizador, guarda a acao que aplica a troca, e avisa quem
 * estiver ouvindo. Nao importa React e nao toca no DOM, entao e conferivel sem
 * montar nada.
 */

let updateAvailable = false;
let applyUpdate = null;

const listeners = new Set();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/** Assina a mudanca do sinalizador. Devolve a funcao que cancela a assinatura. */
export function subscribeToUpdate(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Leitura do sinalizador. E um booleano, entao a mesma leitura devolve o mesmo valor. */
export function getUpdateSnapshot() {
  return updateAvailable;
}

/**
 * Registra que ha versao nova esperando, junto da acao que a aplica. Chamar de
 * novo com outra acao substitui a anterior: vale sempre a ultima descoberta.
 */
export function announceUpdate(apply) {
  applyUpdate = typeof apply === 'function' ? apply : null;
  updateAvailable = true;
  notify();
}

/**
 * Aplica a atualizacao pendente. Devolve `false` quando nao ha nada a aplicar,
 * para que a tela nao prometa uma troca que nao vai acontecer.
 */
export function applyPendingUpdate() {
  if (!applyUpdate) {
    return false;
  }

  const apply = applyUpdate;

  applyUpdate = null;
  updateAvailable = false;
  notify();
  apply();

  return true;
}

/** Volta ao estado inicial. Existe para a conferencia automatizada. */
export function resetUpdateState() {
  applyUpdate = null;
  updateAvailable = false;
  notify();
}
