import Button from '../ui/Button.jsx';

import { isCompactSheet } from './printInputs.js';

/**
 * Atalho que aproveita a folha: margem de 5 mm e etiquetas encostadas, num
 * clique, e de volta as margens do modelo no clique seguinte.
 *
 * A etiqueta continua no tamanho do modelo. O que muda e so a sobra em volta
 * dela, e e isso que abre a coluna a mais: a Tag grande em A4 retrato passa de
 * uma para duas colunas, e de tres para oito etiquetas por folha.
 *
 * O botao so troca os seis numeros. Os campos continuam a vista e editaveis
 * logo abaixo, e quem precisa de 6 mm porque a impressora nao chega a 5 ajusta
 * a partir dali. Com o ajuste ligado, a linha de apoio diz o risco: abaixo da
 * borda que a impressora imprime, a etiqueta sai cortada.
 */
export default function SheetFitToggle({ adjustments, onCompact, onRestore }) {
  const isCompact = isCompactSheet(adjustments);

  return (
    <div className="flex flex-col gap-1.5" data-sheet-fit={isCompact ? 'compact' : 'layout'}>
      <Button className="w-full" onClick={isCompact ? onRestore : onCompact}>
        {isCompact ? 'Voltar às margens do modelo' : 'Aproveitar a folha'}
      </Button>

      <p className="text-xs leading-snug text-neutro-tintaFraca">
        {isCompact
          ? 'Margem de 5 mm e etiquetas encostadas. Confira se a impressora imprime até 5 mm da borda.'
          : 'Margem de 5 mm e etiquetas encostadas, para caber mais etiquetas na folha.'}
      </p>
    </div>
  );
}
