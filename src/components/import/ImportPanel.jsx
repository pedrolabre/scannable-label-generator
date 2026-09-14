import { useCallback, useMemo, useState } from 'react';

import { summarizeImportFiles } from '../../domain/services/importService.js';
import { useImportStore } from '../../store/useImportStore.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';

import ImportFilePicker from './ImportFilePicker.jsx';
import ImportFileStatusList from './ImportFileStatusList.jsx';
import ImportReviewPanel from './ImportReviewPanel.jsx';

/**
 * Cartao da importacao em lote. Reune a escolha dos arquivos, o resumo do que
 * foi lido, o resultado de cada arquivo e a revisao dos registros conferidos.
 *
 * A falha de um arquivo do lote e informacao da lista, nao deste nivel: o
 * aviso aqui cobre so a falha que impede o lote inteiro de comecar.
 *
 * O resumo deste cartao continua contando arquivos e registros lidos. Quantos
 * registros estao prontos e assunto da revisao, logo abaixo, que e onde o
 * numero pode ser lido junto do motivo de cada excecao.
 */
function summaryText({ parsedFiles, rejectedFiles, recordCount }) {
  const records = recordCount === 1 ? '1 registro' : `${recordCount} registros`;
  const accepted = parsedFiles === 1 ? '1 arquivo' : `${parsedFiles} arquivos`;

  if (rejectedFiles === 0) {
    return `${records} de ${accepted}.`;
  }

  const rejected = rejectedFiles === 1 ? '1 arquivo recusado' : `${rejectedFiles} arquivos recusados`;

  return `${records} de ${accepted}. ${rejected}.`;
}

export default function ImportPanel() {
  const isParsing = useImportStore((state) => state.isParsing);
  const isChecking = useImportStore((state) => state.isChecking);
  const files = useImportStore((state) => state.files);
  const parseFiles = useImportStore((state) => state.parseFiles);
  const reset = useImportStore((state) => state.reset);

  const [batchError, setBatchError] = useState(null);

  const summary = useMemo(() => summarizeImportFiles(files), [files]);

  const handleFilesSelected = useCallback(
    (selected) => {
      setBatchError(null);

      parseFiles(selected).catch(() => {
        setBatchError('Não foi possível ler os arquivos escolhidos. Tente de novo.');
      });
    },
    [parseFiles],
  );

  const handleClear = useCallback(() => {
    setBatchError(null);
    reset();
  }, [reset]);

  const isBusy = isParsing || isChecking;

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Importação em lote</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Leia planilhas e notas fiscais de uma vez, confira o que veio e grave no catálogo deste
            dispositivo. Código repetido é apresentado para você decidir, e nada é sobrescrito sem
            a sua escolha.
          </p>
        </div>

        {files.length > 0 && !isBusy ? (
          <Button type="button" onClick={handleClear}>
            Limpar
          </Button>
        ) : null}
      </div>

      <ImportFilePicker isParsing={isBusy} onFilesSelected={handleFilesSelected} />

      {batchError ? <InlineAlert>{batchError}</InlineAlert> : null}

      {files.length > 0 ? (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
          {summaryText(summary)}
        </p>
      ) : null}

      <ImportFileStatusList files={files} />

      <ImportReviewPanel />
    </Card>
  );
}
