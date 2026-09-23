import { cx } from '../../lib/cx.js';

/**
 * As linhas de um registro: uma por campo com algo a dizer.
 *
 * O veredito vem em cima, a causa logo abaixo quando existe, e o texto como
 * veio do arquivo por ultimo. A causa so aparece quando ela explica um veredito
 * que nao se explica sozinho — o contrato diz o que falta, o aviso diz por que
 * faltou —, e por isso nenhuma linha repete a outra.
 *
 * A cor separa o que impede de gravar do que so pede conferencia: vermelho de
 * perigo suave para a recusa, ambar para a observacao, os mesmos tokens do
 * restante da interface.
 */
export default function ImportRecordIssueList({ lines }) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2">
      {lines.map((line, index) => (
        <li
          key={`${line.field ?? 'registro'}-${index}`}
          className={cx(
            'border-l-2 pl-3',
            line.blocking ? 'border-marca-vermelhoTexto' : 'border-marca-amareloTexto',
          )}
        >
          <p
            className={cx(
              'text-sm',
              line.blocking ? 'text-marca-vermelhoTexto' : 'text-marca-amareloTexto',
            )}
          >
            {line.message}
          </p>

          {line.cause ? <p className="text-xs text-neutro-tintaFraca">{line.cause}</p> : null}

          {line.rawValue ? (
            <p className="text-xs text-neutro-tintaFraca">
              No arquivo: <span className="font-mono text-neutro-tintaMedia">{line.rawValue}</span>
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
