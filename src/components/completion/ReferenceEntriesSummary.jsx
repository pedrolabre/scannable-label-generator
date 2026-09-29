import { formatCount, pluralize } from '../import/importCounts.js';

/**
 * O que a planilha deixa na base de referencia: quantos codigos entram, com
 * que campos, e o que fica fora — antes da gravacao e, depois dela, como
 * resultado.
 *
 * Aparece so quando o lote tem planilha `.ods`, que e o unico arquivo que
 * alimenta a base. A frase diz que a base e substituida, porque a carga troca
 * a base inteira e o operador precisa saber disso antes de confirmar.
 */

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

export default function ReferenceEntriesSummary({ summary, result }) {
  const ignored = leftOut(summary);

  return (
    <div className="space-y-1 border-t border-neutro-divisor pt-3 text-sm" data-resumo-base-referencia="">
      <p className="font-semibold text-neutro-tintaMedia">Base de referência</p>
      {result ? (
        <p role="status" className="text-marca-verdeTexto">
          {result.entryCount === 1
            ? 'Base de referência guardada com 1 código.'
            : `Base de referência guardada com ${formatCount(result.entryCount)} códigos.`}
        </p>
      ) : (
        <p className="text-neutro-tintaMedia">
          {summary.entryCount === 0
            ? 'A planilha não tem código com NCM ou código de barras válido; a base guardada fica como está.'
            : `${pluralize(summary.entryCount, 'código da planilha substitui', 'códigos da planilha substituem')} a base guardada neste navegador: ${formatCount(summary.withNcm)} com NCM e ${formatCount(summary.withEan)} com código de barras.`}
        </p>
      )}
      {ignored.length > 0 ? (
        <p className="text-neutro-tintaFraca">Ficam fora: {ignored.join(', ')}.</p>
      ) : null}
    </div>
  );
}
