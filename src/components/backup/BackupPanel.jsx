import Button from '../ui/Button.jsx';
import ModalShell from '../ui/ModalShell.jsx';

import BackupExportSection from './BackupExportSection.jsx';
import BackupRestoreSection from './BackupRestoreSection.jsx';

/**
 * Dialogo do arquivo de backup: gerar e restaurar, no mesmo lugar.
 *
 * Um dialogo so, e nao dois, porque as duas acoes sao as duas metades de um
 * mesmo assunto — o arquivo. Separadas, cada metade repetiria a explicacao do
 * que o arquivo e, e a segunda explicacao acabaria divergindo da primeira.
 *
 * Ele nao fecha no clique fora, pelo mesmo motivo da importacao: restaurar
 * consome um arquivo ja escolhido e conferido.
 *
 * Ele e alcancado pelo cabecalho, e nao por uma coluna. Backup nao e passo do
 * trabalho de impressao nem da listagem: e manutencao do ambiente inteiro. E
 * como restaurar substitui o catalogo, uma acao dessas ocupando lugar fixo na
 * tela de uso diario seria um convite a acidente.
 */
export default function BackupPanel({ productCount, onRestored, onClose }) {
  return (
    <ModalShell
      title="Arquivo de backup"
      subtitle="Um texto legível, conferível em qualquer editor antes de ser restaurado."
      width={640}
      closeOnBackdrop={false}
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-6">
        <p className="text-sm leading-relaxed text-neutro-tintaMedia">
          Leve o conteúdo deste dispositivo para outro, ou guarde uma cópia fora dele.
        </p>

        <BackupExportSection productCount={productCount} />

        <BackupRestoreSection currentProductCount={productCount} onRestored={onRestored} />
      </div>
    </ModalShell>
  );
}
