import { Undo2 } from 'lucide-react';

import { DISPLAY_NAME_MAX_LENGTH } from '../../domain/schemas/productSchema.js';
import Field, { TextInput } from '../ui/Field.jsx';
import IconButton from '../ui/IconButton.jsx';

/**
 * O nome da etiqueta de um registro do lote, editavel na propria linha.
 *
 * Ele chega ja preenchido — encurtado a partir do texto do produto quando esse texto
 * passa do limite — e e o unico campo que a revisao precisa corrigir para que o
 * registro possa seguir. Editar no lugar mantem a correcao ao lado do motivo
 * que a pediu e do texto completo, que e o que permite decidir o corte.
 *
 * O valor original nunca some: enquanto houver ajuste, ele fica visivel abaixo
 * do campo e o botao devolve o registro ao que o arquivo trazia.
 */
export default function ImportDisplayNameField({
  recordId,
  value,
  originalValue,
  corrected,
  error,
  onChange,
  onRevert,
}) {
  const fieldId = `etiqueta-${recordId.replace(':', '-')}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field
            id={fieldId}
            label="Nome da etiqueta"
            hint={`${value.length}/${DISPLAY_NAME_MAX_LENGTH}`}
            error={error}
          >
            {(controlProps) => (
              <TextInput
                {...controlProps}
                focus="brand"
                value={value}
                onChange={(event) => onChange(event.target.value)}
              />
            )}
          </Field>
        </div>

        {corrected ? (
          <IconButton label="Desfazer o ajuste do nome" onClick={onRevert} className="mb-0.5">
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>

      {corrected ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {originalValue === '' ? (
            'Ajustado por você. O arquivo não trazia nome para este registro.'
          ) : (
            <>
              Ajustado por você. No arquivo:{' '}
              <span className="font-mono text-slate-700 dark:text-slate-200">{originalValue}</span>
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
