import { useState } from 'react';

import Button from '../ui/Button.jsx';
import ModalShell from '../ui/ModalShell.jsx';

import PrintExportControls from './PrintExportControls.jsx';
import SheetPreview from './SheetPreview.jsx';
import SheetScalePicker, { DEFAULT_SHEET_SCALE } from './SheetScalePicker.jsx';

/**
 * Dialogo da folha de impressao, aberto por `Prévia da folha` na coluna da
 * esquerda.
 *
 * Ele e irmao do dialogo da etiqueta, e nao uma aba dele: cada um abre pelo seu
 * gatilho, com o seu titulo, e fecha de volta para onde estava. A tela continua
 * com um dialogo por vez.
 *
 * A altura e fixa porque o conteudo nao a define: a folha ocupa o espaco que
 * houver, e a mesa rola o que sobrar. O corpo da moldura nao rola, e por isso a
 * mesa e a unica regiao rolavel aqui dentro.
 *
 * O tamanho do desenho fica no cabecalho, ao lado do fechar, porque governa a
 * mesa inteira. Ele comeca pela metade, que e onde a folha cabe inteira, e
 * volta a metade a cada abertura: e ajuste de conferencia, nao preferencia.
 *
 * A exportacao daqui e a mesma da coluna — mesmo `exporter`, mesmo trabalho —,
 * entao quem confere a folha exporta sem fechar o dialogo, e quem fecha durante
 * a geracao encontra o progresso no rodape da coluna.
 *
 * O dialogo so abre com o trabalho pronto, e o gatilho respeita isso. Se o
 * trabalho deixar de valer com ele aberto, o miolo troca pelo motivo em vez de
 * desenhar uma folha que nao existe.
 */

export const SHEET_DIALOG_WIDTH = 1160;
export const SHEET_DIALOG_HEIGHT = 760;

export default function SheetPreviewDialog({ printState, products, exporter, onClose }) {
  const [scaleFactor, setScaleFactor] = useState(DEFAULT_SHEET_SCALE);

  const { isReady, job, sheet, labelLayout, grid, blockingMessage } = printState;
  const exportRequest = isReady ? { job, sheet, labelLayout, grid, products } : null;

  const closeButton = (
    <Button className="w-full" onClick={onClose}>
      Fechar
    </Button>
  );

  return (
    <ModalShell
      title="Prévia da folha"
      width={SHEET_DIALOG_WIDTH}
      height={SHEET_DIALOG_HEIGHT}
      scrollBody={false}
      onClose={onClose}
      headerActions={
        isReady && grid.perSheet > 0 ? (
          <SheetScalePicker
            value={scaleFactor}
            onChange={setScaleFactor}
            className="[&>legend]:sr-only [&>legend]:mb-0"
          />
        ) : null
      }
    >
      {isReady ? (
        <SheetPreview
          job={job}
          sheet={sheet}
          labelLayout={labelLayout}
          grid={grid}
          products={products}
          scaleFactor={scaleFactor}
          actions={
            <PrintExportControls
              exporter={exporter}
              request={exportRequest}
              leadingAction={closeButton}
            />
          }
        />
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-4 p-6" data-sheet-state="blocked">
          <p className="text-sm text-neutro-tintaMedia">{blockingMessage}</p>
          <div className="w-full self-end lg:w-[260px]">{closeButton}</div>
        </div>
      )}
    </ModalShell>
  );
}
