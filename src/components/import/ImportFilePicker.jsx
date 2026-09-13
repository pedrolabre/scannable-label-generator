import { useCallback, useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';

import { ACCEPTED_FILE_EXTENSIONS } from '../../domain/services/importService.js';
import { cx } from '../../lib/cx.js';
import Button from '../ui/Button.jsx';

/**
 * Escolha dos arquivos do lote, pelo seletor do sistema ou arrastando para a
 * area. O `input` fica fora da tela em vez de escondido com `display: none`,
 * para continuar alcancavel pelo teclado e anunciado pelo leitor de tela; o
 * botao visivel apenas o aciona.
 *
 * O campo e zerado depois de cada escolha: sem isso, escolher o mesmo arquivo
 * duas vezes seguidas nao dispara `change` e a segunda tentativa pareceria
 * ignorada.
 */
export default function ImportFilePicker({ isParsing, onFilesSelected }) {
  const inputRef = useRef(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleChange = useCallback(
    (event) => {
      const selected = Array.from(event.target.files ?? []);

      event.target.value = '';

      if (selected.length > 0) {
        onFilesSelected(selected);
      }
    },
    [onFilesSelected],
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setIsDraggingOver(false);

      if (isParsing) {
        return;
      }

      const dropped = Array.from(event.dataTransfer?.files ?? []);

      if (dropped.length > 0) {
        onFilesSelected(dropped);
      }
    },
    [isParsing, onFilesSelected],
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDraggingOver(false);
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cx(
        'flex flex-col items-center gap-3 rounded-[3px] border border-dashed px-6 py-10 text-center transition-colors',
        isDraggingOver
          ? 'border-[#cf1026] bg-[#fff1ea] dark:bg-[#3b211b]'
          : 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950',
      )}
    >
      {isParsing ? (
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden="true" />
      ) : (
        <FileUp className="h-8 w-8 text-slate-300 dark:text-slate-600" aria-hidden="true" />
      )}

      <p className="text-sm text-slate-600 dark:text-slate-300">
        Arraste os arquivos para cá ou escolha no computador.
      </p>

      <input
        ref={inputRef}
        id="import-files"
        type="file"
        multiple
        accept={ACCEPTED_FILE_EXTENSIONS.join(',')}
        onChange={handleChange}
        disabled={isParsing}
        className="sr-only"
      />

      <Button type="button" onClick={() => inputRef.current?.click()} disabled={isParsing}>
        {isParsing ? 'Lendo arquivos…' : 'Escolher arquivos'}
      </Button>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Aceita planilhas .csv, listas .json e notas fiscais .xml. Vários arquivos de uma vez.
      </p>
    </div>
  );
}
