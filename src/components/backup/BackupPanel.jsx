import Card from '../ui/Card.jsx';

import BackupExportSection from './BackupExportSection.jsx';
import BackupRestoreSection from './BackupRestoreSection.jsx';

/**
 * Cartao do arquivo de backup: gerar e restaurar, no mesmo lugar.
 *
 * Um cartao so, e nao dois, porque as duas acoes sao as duas metades de um mesmo
 * assunto — o arquivo. Separadas, cada metade repetiria a explicacao do que o
 * arquivo e, e a segunda explicacao acabaria divergindo da primeira.
 *
 * O cartao fica no fim da pagina. A ordem da tela e um funil — trazer, cadastrar,
 * conferir, listar, imprimir —, e o backup nao e passo dele: e manutencao do
 * ambiente inteiro. Alem disso, restaurar substitui o catalogo, e uma acao
 * dessas acima do formulario de uso diario seria um convite a acidente.
 */
export default function BackupPanel({ productCount, onRestored }) {
  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Arquivo de backup</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Leve o conteúdo deste dispositivo para outro, ou guarde uma cópia fora dele. O arquivo é
          um texto legível, e pode ser conferido em qualquer editor antes de ser restaurado.
        </p>
      </div>

      <BackupExportSection productCount={productCount} />

      <BackupRestoreSection currentProductCount={productCount} onRestored={onRestored} />
    </Card>
  );
}
