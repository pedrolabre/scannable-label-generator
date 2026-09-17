import Button from '../ui/Button.jsx';

/**
 * Botao da acao terminal da pagina, e o unico botao primario do painel.
 *
 * Ele nao decide nada: recebe se pode exportar e se ja esta exportando, e o
 * rotulo acompanha. O que o operador le enquanto espera aparece ao lado, na
 * linha de estado, e nao dentro do botao.
 */

const IDLE_LABEL = 'Exportar PDF';
const RUNNING_LABEL = 'Exportando…';

export default function PrintExportButton({ running = false, disabled = false, onExport }) {
  return (
    <Button
      variant="primary"
      onClick={onExport}
      disabled={disabled || running}
      data-export-button={running ? 'running' : 'idle'}
    >
      {running ? RUNNING_LABEL : IDLE_LABEL}
    </Button>
  );
}
