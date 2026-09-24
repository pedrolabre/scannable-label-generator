import { useCallback, useRef } from 'react';
import { FileUp, Loader2 } from 'lucide-react';

import Button from '../ui/Button.jsx';

/**
 * Escolha do arquivo de backup a restaurar.
 *
 * Um arquivo so, e nao varios: restaurar dois retratos de armazenamento um sobre
 * o outro nao tem significado. E por isso que a escolha de arquivo da importacao
 * em lote nao serve aqui — la o lote e feito de varios arquivos, de tres
 * extensoes, e a escolha de um deles nao e uma decisao destrutiva.
 *
 * O `input` fica fora da tela em vez de escondido com `display: none`, para
 * continuar alcancavel pelo teclado e anunciado pelo leitor de tela; o botao
 * visivel apenas o aciona. O campo e zerado depois de cada escolha: sem isso,
 * escolher o mesmo arquivo duas vezes seguidas nao dispara `change` e a segunda
 * tentativa pareceria ignorada.
 */
export default function BackupFilePicker({ isBusy, onFileSelected }) {
  const inputRef = useRef(null);

  const handleChange = useCallback(
    (event) => {
      const [chosen] = Array.from(event.target.files ?? []);

      event.target.value = '';

      if (chosen) {
        onFileSelected(chosen);
      }
    },
    [onFileSelected],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        id="backup-file"
        type="file"
        accept=".json,application/json"
        onChange={handleChange}
        disabled={isBusy}
        className="sr-only"
      />

      <Button type="button" onClick={() => inputRef.current?.click()} disabled={isBusy}>
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileUp className="h-4 w-4" aria-hidden="true" />
        )}
        {isBusy ? 'Conferindo o arquivo…' : 'Escolher arquivo de backup'}
      </Button>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Aceita o arquivo .json gerado pela exportação.
      </p>
    </div>
  );
}
