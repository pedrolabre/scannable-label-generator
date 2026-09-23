import InlineAlert from '../ui/InlineAlert.jsx';

import { pluralize } from './importCounts.js';

/**
 * O que aconteceu com o lote na gravacao, categoria por categoria.
 *
 * Cada registro do lote esta em exatamente uma das linhas abaixo, e a soma delas
 * e o tamanho do lote. Essa conta fechada e o que permite ler o resultado sem
 * abrir o catalogo para conferir: se 4 registros nao entraram, as quatro linhas
 * dizem por que.
 *
 * Quando a gravacao parou no meio, o registro em que ela parou aparece pela frase
 * de origem — a mesma que a revisao usa —, e o motivo vem traduzido pelo store.
 */
function lines(result) {
  const written = result.created + result.replaced;
  const items = [];

  if (written > 0) {
    items.push(
      result.replaced > 0
        ? `${pluralize(written, 'produto gravado', 'produtos gravados')}, ${pluralize(
            result.replaced,
            'deles substituindo um produto que já estava no catálogo',
            'deles substituindo produtos que já estavam no catálogo',
          )}.`
        : `${pluralize(written, 'produto gravado', 'produtos gravados')}.`,
    );
  }

  if (result.carried > 0) {
    items.push(`${pluralize(result.carried, 'registro já gravado', 'registros já gravados')} antes.`);
  }

  if (result.alreadyInCatalog > 0) {
    items.push(
      `${pluralize(
        result.alreadyInCatalog,
        'registro já estava',
        'registros já estavam',
      )} no catálogo, sem diferença nenhuma.`,
    );
  }

  if (result.skipped > 0) {
    items.push(
      `${pluralize(result.skipped, 'registro pulado', 'registros pulados')} por sua decisão.`,
    );
  }

  if (result.blocked > 0) {
    items.push(
      `${pluralize(
        result.blocked,
        'registro não foi gravado',
        'registros não foram gravados',
      )}: recusa do contrato ou código repetido sem decisão.`,
    );
  }

  if (result.notAttempted > 0) {
    items.push(
      `${pluralize(
        result.notAttempted,
        'registro não chegou a ser gravado',
        'registros não chegaram a ser gravados',
      )}.`,
    );
  }

  return items;
}

export default function ImportWriteResult({ result, error }) {
  if (!result) {
    return null;
  }

  const written = result.created + result.replaced;

  return (
    <div className="space-y-2 rounded border border-neutro-divisor p-3">
      <p role="status" className="text-sm font-semibold text-neutro-tintaMedia">
        {written > 0 ? 'Lote gravado no catálogo.' : 'Nada foi gravado no catálogo.'}
      </p>

      <ul className="space-y-1 text-sm text-neutro-tintaFraca">
        {lines(result).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {result.stopped ? (
        <p className="text-sm text-neutro-tintaFraca">
          A gravação foi interrompida por você. O que já entrou está no catálogo.
        </p>
      ) : null}

      {result.failure ? (
        <InlineAlert>
          {`A gravação parou em ${result.failure.origin ?? 'um dos registros'}. ${error ?? ''}`.trim()}
        </InlineAlert>
      ) : null}
    </div>
  );
}
