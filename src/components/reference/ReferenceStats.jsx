import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';
import { formatCount } from '../import/importCounts.js';

/**
 * O que a base de referencia guarda neste navegador: quantos codigos, quantos
 * com NCM, quantos com codigo de barras e quando ela foi carregada.
 *
 * Base vazia nao e erro: e o estado de quem ainda nao carregou um arquivo, e a
 * frase diz como carregar. A falha de leitura, essa sim, aparece como aviso,
 * com a acao de tentar de novo — sem ela a tela mostraria uma base vazia,
 * indistinguivel de uma base que nunca foi carregada.
 */

export function formatLoadedAt(isoDate) {
  const date = new Date(isoDate);

  return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-neutro-tintaFraca">{label}</dt>
      <dd className="font-semibold tabular-nums text-neutro-tintaMedia">{value}</dd>
    </div>
  );
}

export default function ReferenceStats({ stats, isLoading, error, onRetry }) {
  if (error) {
    return (
      <div className="space-y-2">
        <InlineAlert>{`${error} Não foi possível ler a base de referência.`}</InlineAlert>
        <Button type="button" onClick={onRetry}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <p role="status" className="text-sm text-neutro-tintaFraca">
        Lendo a base de referência…
      </p>
    );
  }

  if (stats.total === 0) {
    return (
      <p role="status" className="text-sm text-neutro-tintaMedia" data-base-vazia="">
        A base de referência está vazia. Carregue um arquivo aqui ou pelo Completar dados para que a
        importação complete o NCM e o código de barras.
      </p>
    );
  }

  return (
    <dl
      aria-label="Base guardada"
      className="divide-y divide-neutro-divisor border-y border-neutro-divisor text-sm"
      data-estatisticas-base=""
    >
      <Line label="Códigos na base" value={formatCount(stats.total)} />
      <Line label="Com NCM" value={formatCount(stats.withNcm)} />
      <Line label="Com código de barras" value={formatCount(stats.withEan)} />
      <Line label="Última carga" value={stats.loadedAt ? formatLoadedAt(stats.loadedAt) : '—'} />
    </dl>
  );
}
