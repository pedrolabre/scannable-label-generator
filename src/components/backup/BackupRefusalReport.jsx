import {
  describeOmittedIssues,
  describeRefusalHeadline,
  describeRefusalLine,
} from '../../domain/services/backupText.js';
import InlineAlert from '../ui/InlineAlert.jsx';

/**
 * O relatorio da recusa, junto do botao que escolheu o arquivo.
 *
 * Lista todos os problemas encontrados ate o teto, e conta o restante. A
 * biblioteca de contrato ja devolve todas as recusas numa passada: mostrar so a
 * primeira obrigaria a corrigir o arquivo uma linha por tentativa.
 *
 * A primeira frase diz que nada foi alterado. E a informacao mais importante da
 * tela neste momento, e ela nao pode ficar por conta do que o operador supoe.
 */
export default function BackupRefusalReport({ report }) {
  const omitted = describeOmittedIssues(report.omittedIssues);

  return (
    <div className="space-y-2">
      <InlineAlert>{describeRefusalHeadline(report.totalIssues)}</InlineAlert>

      <ul className="space-y-1 pl-4 text-sm text-neutro-tintaFraca">
        {report.issues.map((issue, index) => (
          <li key={`${issue.where ?? 'arquivo'}-${index}`} className="list-disc">
            {describeRefusalLine(issue)}
          </li>
        ))}
      </ul>

      {omitted ? <p className="text-sm text-neutro-tintaFraca">{omitted}</p> : null}
    </div>
  );
}
