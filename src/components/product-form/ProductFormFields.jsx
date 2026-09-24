import {
  DESCRIPTION_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  NCM_LENGTH,
} from '../../domain/schemas/productSchema.js';

import Field, { Textarea, TextInput } from '../ui/Field.jsx';

const FIELD_ID_PREFIX = 'product';

function fieldId(name) {
  return `${FIELD_ID_PREFIX}-${name}`;
}

function counterHint(text, limit) {
  return `${text.trim().length}/${limit}`;
}

/**
 * Os oito campos do produto. O grupo superior reune o que sai impresso na
 * etiqueta, o do meio os codigos de identificacao e o preco, e o inferior a
 * informacao de apoio.
 */
export default function ProductFormFields({ values, errors, formattedPrice, onChange }) {
  const handle = (name) => (event) => onChange(name, event.target.value);

  return (
    <div className="space-y-4">
      <Field
        id={fieldId('displayName')}
        label="Nome da etiqueta"
        hint={counterHint(values.displayName, DISPLAY_NAME_MAX_LENGTH)}
        error={errors.displayName}
      >
        {(control) => (
          <TextInput
            {...control}
            focus="brand"
            value={values.displayName}
            onChange={handle('displayName')}
            placeholder="Texto que sai impresso na etiqueta"
            autoComplete="off"
          />
        )}
      </Field>

      <Field
        id={fieldId('description')}
        label="Descrição completa"
        hint={counterHint(values.description, DESCRIPTION_MAX_LENGTH)}
        error={errors.description}
        optional
      >
        {(control) => (
          <Textarea
            {...control}
            focus="brand"
            value={values.description}
            onChange={handle('description')}
            placeholder="Descrição longa do produto, para consulta"
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={fieldId('systemCode')} label="Código do sistema" error={errors.systemCode}>
          {(control) => (
            <TextInput
              {...control}
              focus="code"
              value={values.systemCode}
              onChange={handle('systemCode')}
              placeholder="0012345"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Field>

        <Field id={fieldId('ean')} label="Código de barras" error={errors.ean} optional>
          {(control) => (
            <TextInput
              {...control}
              focus="code"
              value={values.ean}
              onChange={handle('ean')}
              placeholder="7891234567895"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Field>

        <Field
          id={fieldId('ncm')}
          label="NCM"
          hint={`${NCM_LENGTH} dígitos`}
          error={errors.ncm}
          optional
        >
          {(control) => (
            <TextInput
              {...control}
              focus="code"
              value={values.ncm}
              onChange={handle('ncm')}
              placeholder="94035000"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={fieldId('price')}
          label="Preço"
          hint={formattedPrice ?? undefined}
          error={errors.price}
        >
          {(control) => (
            <TextInput
              {...control}
              focus="price"
              value={values.price}
              onChange={handle('price')}
              placeholder="19,90"
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
            />
          )}
        </Field>

        <Field id={fieldId('category')} label="Categoria" error={errors.category} optional>
          {(control) => (
            <TextInput
              {...control}
              value={values.category}
              onChange={handle('category')}
              placeholder="Eletrodomésticos"
              autoComplete="off"
            />
          )}
        </Field>
      </div>

      <Field id={fieldId('notes')} label="Observações" error={errors.notes} optional>
        {(control) => (
          <Textarea
            {...control}
            value={values.notes}
            onChange={handle('notes')}
            placeholder="Anotações internas sobre o produto"
          />
        )}
      </Field>
    </div>
  );
}
