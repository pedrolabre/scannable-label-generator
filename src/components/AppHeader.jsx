import { Tags } from 'lucide-react';

import { APP_NAME, APP_TAGLINE } from '../lib/app-meta.js';

export default function AppHeader() {
  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
        <Tags
          className="h-6 w-6 shrink-0 text-slate-500 dark:text-slate-400"
          aria-hidden="true"
        />
        <div>
          <h1 className="text-base font-semibold leading-tight">{APP_NAME}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{APP_TAGLINE}</p>
        </div>
      </div>
    </header>
  );
}
