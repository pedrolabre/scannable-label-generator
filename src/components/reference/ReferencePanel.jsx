import { useEffect } from 'react';

import { useReferenceStore } from '../../store/useReferenceStore.js';
import Button from '../ui/Button.jsx';
import ModalShell from '../ui/ModalShell.jsx';

import ClearReferenceButton from './ClearReferenceButton.jsx';
import ReferenceCompletionSection from './ReferenceCompletionSection.jsx';
import ReferenceSheetSection from './ReferenceSheetSection.jsx';
import ReferenceStats from './ReferenceStats.jsx';

/**
 * Dialogo da base de referencia: codigo, NCM e codigo de barras.
 *
 * Ele e irmao do Completar dados, e nao uma secao dele, porque a base vale por
 * si: e ela que a importacao consulta, e o operador precisa ver o que ela
 * guarda sem ler arquivo nenhum. As tres primeiras partes — o que a base
 * guarda, a carga por arquivo e o apagar — nunca tocam o catalogo; a ultima,
 * completar o catalogo pela base, grava produtos e por isso fica separada, com
 * resumo antes.
 *
 * As estatisticas sao lidas a cada abertura. Como os outros dialogos de
 * arquivo, ele nao fecha no clique fora, e fechar nao descarta o arquivo lido.
 */
export default function ReferencePanel({ onClose }) {
  const stats = useReferenceStore((state) => state.stats);
  const isLoadingStats = useReferenceStore((state) => state.isLoadingStats);
  const statsError = useReferenceStore((state) => state.statsError);
  const loadStats = useReferenceStore((state) => state.loadStats);
  const clearBase = useReferenceStore((state) => state.clearBase);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const total = stats?.total ?? 0;

  return (
    <ModalShell
      title="Base de referência"
      subtitle="Código, NCM e código de barras guardados neste navegador para completar a importação."
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
        <section aria-labelledby="base-guardada" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="base-guardada" className="text-base font-semibold">
              Base guardada
            </h3>

            {total > 0 && !statsError ? <ClearReferenceButton total={total} onClear={clearBase} /> : null}
          </div>

          <ReferenceStats
            stats={stats}
            isLoading={isLoadingStats}
            error={statsError}
            onRetry={loadStats}
          />
        </section>

        <ReferenceSheetSection />

        <ReferenceCompletionSection isBaseEmpty={total === 0} />
      </div>
    </ModalShell>
  );
}
