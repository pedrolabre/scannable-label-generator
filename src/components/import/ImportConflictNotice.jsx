import { availableDecisions } from '../../domain/services/importConflict.js';
import Button from '../ui/Button.jsx';

import {
  DECISION_LABEL,
  DECISION_RESULT,
  describeCodeConflict,
  describeNameConflict,
  describeStoredProduct,
} from './conflictLabels.js';

/**
 * O codigo repetido de um registro, e a resposta do usuario.
 *
 * O conflito nao aparece entre as linhas de campo porque nao e um campo
 * recusado: e uma pergunta, e a resposta e um verbo. Por isso ele tem area
 * propria, com o produto gravado a vista — sem ver o que ja esta no catalogo nao
 * ha como escolher entre substituir e manter.
 *
 * Enquanto nao ha resposta, este registro nao grava. Nenhum outro e afetado: o
 * resto do lote segue para o catalogo normalmente, e e isso que permite decidir
 * tres conflitos com calma num lote de duzentos mil registros.
 *
 * A colisao de nome fica na mesma area, sem botao nenhum, porque e aviso: o nome
 * nao identifica produto, e o texto completo que resolve a duvida ja esta logo
 * acima, na propria linha.
 */
export default function ImportConflictNotice({ conflict, onDecide }) {
  if (!conflict) {
    return null;
  }

  const decisions = availableDecisions(conflict);
  const stored = conflict.code?.storedProduct ?? null;

  return (
    <div className="space-y-2 border-l-2 border-[#8a5a00] pl-3 dark:border-[#f4c95f]">
      {conflict.code ? (
        <p className="text-sm text-[#8a5a00] dark:text-[#f4c95f]">
          {describeCodeConflict(conflict.code)}
        </p>
      ) : null}

      {stored ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          No catálogo:{' '}
          <span className="text-slate-800 dark:text-slate-100">{describeStoredProduct(stored)}</span>
        </p>
      ) : null}

      {conflict.name ? (
        <p className="text-sm text-[#8a5a00] dark:text-[#f4c95f]">
          {describeNameConflict(conflict.name)}
        </p>
      ) : null}

      {decisions.length > 0 ? (
        <div className="space-y-1.5">
          <div
            role="group"
            aria-label="O que fazer com este registro"
            className="flex flex-wrap gap-2"
          >
            {decisions.map((decision) => (
              <Button
                key={decision}
                type="button"
                variant={conflict.decision === decision ? 'primary' : 'secondary'}
                aria-pressed={conflict.decision === decision}
                onClick={() => onDecide(decision)}
              >
                {DECISION_LABEL[decision]}
              </Button>
            ))}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            {conflict.decision
              ? DECISION_RESULT[conflict.decision]
              : 'Escolha uma das opções para este registro poder ser gravado.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
