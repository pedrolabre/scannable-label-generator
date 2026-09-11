import { AlertTriangle, Save } from 'lucide-react';

import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

import ProductFormFields from './ProductFormFields.jsx';
import { useProductForm } from './useProductForm.js';

/**
 * Formulario do produto, usado tanto para cadastrar quanto para editar.
 *
 * Receber `product` coloca o formulario em modo de edicao: os controles abrem
 * preenchidos e o resultado do envio preserva o identificador e a data de
 * criacao do registro original. Sem `product`, cada envio produz um registro
 * novo e limpa os campos.
 *
 * O produto validado vai para `onSubmit`, que decide o que fazer com ele. Para
 * trocar o produto em edicao, remonte o componente com uma `key` diferente.
 */
export default function ProductForm({ product = null, onSubmit, onCancel }) {
  const {
    values,
    errors,
    formattedPrice,
    isEditing,
    isSubmitting,
    submitError,
    handleChange,
    handleSubmit,
    reset,
  } = useProductForm({ product, onSubmit });

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Editar produto' : 'Cadastrar produto'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            O nome da etiqueta e o preco sao o que aparece impresso. O codigo do sistema alimenta o
            codigo 2D.
          </p>
        </header>

        <ProductFormFields
          values={values}
          errors={errors}
          formattedPrice={formattedPrice}
          onChange={handleChange}
        />

        {submitError ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[3px] border border-[#b93a20] bg-[#fff1ea] p-3 text-sm text-[#b93a20] dark:bg-[#3b211b] dark:text-[#ffb8a7]"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" onClick={onCancel ?? reset} disabled={isSubmitting}>
            {onCancel ? 'Cancelar' : 'Limpar campos'}
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {isEditing ? 'Salvar alteracoes' : 'Cadastrar produto'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
