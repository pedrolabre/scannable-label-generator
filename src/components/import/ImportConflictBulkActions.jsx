import {
  CONFLICT_KIND_CATALOG,
  DECISION_KEEP_BOTH,
  DECISION_REPLACE,
  DECISION_SKIP,
} from '../../domain/services/importConflict.js';
import Button from '../ui/Button.jsx';

import { pluralize } from './importCounts.js';

/**
 * A mesma resposta para todos os conflitos que ainda esperam decisao.
 *
 * Decidir registro a registro e a granularidade certa quando sao tres — e quase
 * sempre sao. Mas uma planilha reenviada inteira produz o lote todo em conflito
 * com o catalogo, e ai a resposta e uma so para todos, e clicar milhares de vezes
 * nao e uma opcao.
 *
 * "Substituir" aparece restrito aos conflitos com o catalogo, porque nao existe
 * produto gravado para substituir num conflito interno do lote — oferecer o verbo
 * para o lote inteiro faria a acao significar duas coisas diferentes em duas
 * linhas.
 */
export default function ImportConflictBulkActions({ summary, onDecideAll }) {
  if (!summary || summary.pending === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded border border-marca-amareloBorda bg-marca-amareloTenue p-3">
      <p className="text-sm text-marca-amareloTexto">
        {pluralize(
          summary.pending,
          'registro com código repetido espera decisão',
          'registros com código repetido esperam decisão',
        )}
        .
      </p>

      <div role="group" aria-label="Decidir todos de uma vez" className="flex flex-wrap gap-2">
        {summary.pendingInCatalog > 0 ? (
          <Button type="button" onClick={() => onDecideAll(DECISION_REPLACE, CONFLICT_KIND_CATALOG)}>
            Substituir os {summary.pendingInCatalog} do catálogo
          </Button>
        ) : null}

        <Button type="button" onClick={() => onDecideAll(DECISION_SKIP)}>
          Pular todos
        </Button>

        <Button type="button" onClick={() => onDecideAll(DECISION_KEEP_BOTH)}>
          Gravar todos como novos
        </Button>
      </div>
    </div>
  );
}
