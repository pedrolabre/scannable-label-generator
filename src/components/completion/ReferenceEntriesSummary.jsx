import { formatCount, pluralize } from '../import/importCounts.js';

/**
 * O que o arquivo deixa na base de referencia: quantos codigos entram, com que
 * campos, o que muda na base guardada e o que fica fora — antes da gravacao e,
 * depois dela, como resultado.
 *
 * Aparece so quando o lote tem arquivo em colunas com NCM ou codigo de barras.
 */

export function mergeCounts({ added, updated, unchanged }) {
  return [
    pluralize(added, 'novo', 'novos'),
    pluralize(updated, 'atualizado', 'atualizados'),
    pluralize(unchanged, 'igual', 'iguais'),
  ].join(' · ');
}

function resultSentence(result) {
  if (result.mode === 'replace') {
    const kept = pluralize(result.entryCount, 'código guardado', 'códigos guardados');
    const removed = pluralize(result.removed, 'removido', 'removidos');

    return `Base de referência trocada: ${kept} · ${removed}.`;
  }

  return `Base de referência atualizada: ${mergeCounts(result)}.`;
}

function leftOut(summary) {
  const parts = [];

  if (summary.invalidNcm > 0) {
    parts.push(pluralize(summary.invalidNcm, 'NCM inválido', 'NCM inválidos'));
  }

  if (summary.invalidEan > 0) {
    parts.push(pluralize(summary.invalidEan, 'código de barras inválido', 'códigos de barras inválidos'));
  }

  if (summary.unusable > 0) {
    parts.push(pluralize(summary.unusable, 'linha sem dado aproveitável', 'linhas sem dado aproveitável'));
  }

  if (summary.repeated > 0) {
    parts.push(pluralize(summary.repeated, 'código repetido', 'códigos repetidos'));
  }

  return parts;
}

export default function ReferenceEntriesSummary({ summary, preview = null, result }) {
  const ignored = leftOut(summary);

  return (
    <div className="space-y-1 border-t border-neutro-divisor pt-3 text-sm" data-resumo-base-referencia="">
      <p className="font-semibold text-neutro-tintaMedia">Base de referência</p>
      {result ? (
        <p role="status" className="text-marca-verdeTexto">
          {resultSentence(result)}
        </p>
      ) : (
        <>
          <p className="text-neutro-tintaMedia">
            {summary.entryCount === 0
              ? 'O arquivo não tem código com NCM ou código de barras válido; a base guardada fica como está.'
              : `${pluralize(summary.entryCount, 'código do arquivo vai', 'códigos do arquivo vão')} para a base: ${formatCount(summary.withNcm)} com NCM e ${formatCount(summary.withEan)} com código de barras.`}
          </p>
          {preview && summary.entryCount > 0 ? (
            <p className="tabular-nums text-neutro-tintaMedia" data-previa-base="">
              {mergeCounts(preview)}
            </p>
          ) : null}
        </>
      )}
      {ignored.length > 0 ? (
        <p className="text-neutro-tintaFraca">Ficam fora: {ignored.join(', ')}.</p>
      ) : null}
    </div>
  );
}
