import { useRef } from 'react';
import { Search, X } from 'lucide-react';

import { cx } from '../../lib/cx.js';

import Field, { TextInput } from '../ui/Field.jsx';
import IconButton from '../ui/IconButton.jsx';

const SEARCH_FIELD_ID = 'product-search';

/**
 * Campo de busca da listagem. A contagem de resultados ocupa a area de apoio do
 * rotulo, ao lado do titulo do campo, e o botao de limpar so existe enquanto ha
 * texto digitado — depois de esvaziar, o foco volta para o campo.
 */
export default function ProductSearchField({ value, onChange, hint }) {
  const inputRef = useRef(null);

  function handleClear() {
    onChange('');
    inputRef.current?.focus();
  }

  return (
    <Field id={SEARCH_FIELD_ID} label="Buscar produto" hint={hint}>
      {(control) => (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutro-tintaFraca"
            aria-hidden="true"
          />

          <TextInput
            {...control}
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Nome, código do sistema ou código de barras"
            autoComplete="off"
            spellCheck={false}
            className={cx('pl-9', value ? 'pr-10' : null)}
          />

          {value ? (
            <IconButton
              label="Limpar busca"
              size="inline"
              onClick={handleClear}
              className="absolute right-1 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          ) : null}
        </div>
      )}
    </Field>
  );
}
