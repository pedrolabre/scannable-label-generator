import { ShieldCheck } from 'lucide-react';

import { APP_NAME } from '../lib/app-meta.js';

export default function LocalOnlyNotice() {
  return (
    <section className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-4">
        <ShieldCheck
          className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">
            O {APP_NAME} funciona localmente no navegador
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Os produtos cadastrados e as etiquetas geradas ficam apenas neste dispositivo. Nada e
            enviado para servidores e nenhuma conta e necessaria.
          </p>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            O cadastro de produtos, a importacao em lote e a montagem das folhas de etiquetas ainda
            nao estao disponiveis nesta versao.
          </p>
        </div>
      </div>
    </section>
  );
}
