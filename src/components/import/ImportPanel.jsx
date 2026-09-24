import { useCallback, useMemo, useState } from 'react';

import { summarizeImportFiles } from '../../domain/services/importService.js';
import { useImportStore } from '../../store/useImportStore.js';
import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';
import ModalShell from '../ui/ModalShell.jsx';

import ImportFilePicker from './ImportFilePicker.jsx';
import ImportFileStatusList from './ImportFileStatusList.jsx';
import ImportReviewPanel from './ImportReviewPanel.jsx';

/**
 * Dialogo da importacao em lote. Reune a escolha dos arquivos, o resumo do que
 * foi lido, o resultado de cada arquivo e a revisao dos registros conferidos.
 *
 * Ele nao fecha no clique fora, e essa e a unica regra que o separa do dialogo
 * de cadastro: aqui ha arquivo ja lido e conferido, e um clique de menos
 * descartaria a leitura inteira.
 *
 * Fechar o dialogo tambem nao zera o lote. Quem decide isso e o fluxo da
 * importacao, pelo botao de limpar, e nao a janela que o mostra: reabrir e
 * encontrar o mesmo lote de volta e o comportamento certo para quem fechou sem
 * querer.
 *
 * A falha de um arquivo do lote e informacao da lista, nao deste nivel: o
 * aviso aqui cobre so a falha que impede o lote inteiro de comecar.
 *
 * O resumo continua contando arquivos e registros lidos. Quantos registros
 * estao prontos e assunto da revisao, logo abaixo, que e onde o numero pode ser
 * lido junto do motivo de cada excecao.
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

export default function ImportPanel({ onClose }) {
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
    <ModalShell
      title="Importar produtos"
      subtitle="Arquivo conferido inteiro antes de qualquer gravação."
      width={680}
      closeOnBackdrop={false}
      onClose={onClose}
      footer={
        <>
          {files.length > 0 && !isBusy ? (
            <Button type="button" onClick={handleClear}>
              Limpar lote
            </Button>
          ) : null}
          <Button type="button" onClick={onClose} disabled={isBusy}>
            Fechar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-neutro-tintaMedia">
          Leia planilhas e notas fiscais de uma vez, confira o que veio e grave no catálogo deste
          dispositivo. Código repetido é apresentado para você decidir, e nada é sobrescrito sem a
          sua escolha.
        </p>

        <ImportFilePicker isParsing={isBusy} onFilesSelected={handleFilesSelected} />

        {batchError ? <InlineAlert>{batchError}</InlineAlert> : null}

        {files.length > 0 ? (
          <p role="status" className="text-sm text-neutro-tintaMedia">
            {summaryText(summary)}
          </p>
        ) : null}

        <ImportFileStatusList files={files} />

        <ImportReviewPanel />
      </div>
    </ModalShell>
  );
}
