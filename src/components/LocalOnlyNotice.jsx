import { ShieldCheck } from 'lucide-react';

import { APP_NAME } from '../lib/app-meta.js';

import Card from './ui/Card.jsx';

export default function LocalOnlyNotice() {
  return (
    <Card className="p-6">
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
            Os produtos cadastrados e as etiquetas geradas ficam apenas neste dispositivo. Nada é
            enviado para servidores e nenhuma conta é necessária.
          </p>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            A etiqueta individual e a folha de etiquetas podem ser conferidas na tela, e a folha
            pode ser exportada em PDF para impressão em escala real.
          </p>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Como tudo fica aqui, o conteúdo só sai daqui por sua conta: o arquivo de backup, no fim
            da página, guarda uma cópia dele e reconstrói o mesmo ambiente em outro dispositivo.
          </p>
        </div>
      </div>
    </Card>
  );
}
