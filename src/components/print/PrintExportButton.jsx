import Button from '../ui/Button.jsx';

/**
 * Botao da acao terminal do trabalho de impressao, e o unico botao primario de
 * onde ele aparece.
 *
 * Ele nao decide nada: recebe se pode exportar e se ja esta exportando, e o
 * rotulo acompanha. O que o operador le enquanto espera aparece acima dele, e
 * nao dentro do botao.
 */

const IDLE_LABEL = 'Exportar PDF';
const RUNNING_LABEL = 'Exportando…';

export default function PrintExportButton({
  running = false,
  disabled = false,
  className,
  onExport,
}) {
  return (
    <Button
      variant="primary"
      className={className}
      onClick={onExport}
      disabled={disabled || running}
      data-export-button={running ? 'running' : 'idle'}
    >
      {running ? RUNNING_LABEL : IDLE_LABEL}
    </Button>
  );
}
