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
        'flex flex-col items-center gap-3 rounded border border-dashed px-6 py-10 text-center transition-colors',
        isDraggingOver
          ? 'border-marca-vermelho bg-marca-vermelhoTenue'
          : 'border-neutro-bordaForte bg-neutro-papel',
      )}
    >
      {isParsing ? (
        <Loader2 className="h-8 w-8 animate-spin text-neutro-tintaFraca" aria-hidden="true" />
      ) : (
        <FileUp className="h-8 w-8 text-neutro-bordaForte" aria-hidden="true" />
      )}

      <p className="text-sm text-neutro-tintaFraca">
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

      <p className="text-xs text-neutro-tintaFraca">
        Aceita planilhas .csv, listas .json e notas fiscais .xml. Vários arquivos de uma vez.
      </p>
    </div>
  );
}
