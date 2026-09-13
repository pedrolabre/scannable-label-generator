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
            line.blocking
              ? 'border-[#b93a20] dark:border-[#ffb8a7]'
              : 'border-[#8a5a00] dark:border-[#f4c95f]',
          )}
        >
          <p
            className={cx(
              'text-sm',
              line.blocking
                ? 'text-[#b93a20] dark:text-[#ffb8a7]'
                : 'text-[#8a5a00] dark:text-[#f4c95f]',
            )}
          >
            {line.message}
          </p>

          {line.cause ? (
            <p className="text-xs text-slate-600 dark:text-slate-300">{line.cause}</p>
          ) : null}

          {line.rawValue ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No arquivo:{' '}
              <span className="font-mono text-slate-700 dark:text-slate-200">{line.rawValue}</span>
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
