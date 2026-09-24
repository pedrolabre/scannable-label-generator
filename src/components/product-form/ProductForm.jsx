import { Save } from 'lucide-react';

import Button from '../ui/Button.jsx';
import InlineAlert from '../ui/InlineAlert.jsx';
import ModalShell from '../ui/ModalShell.jsx';

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
 * Ele vive num dialogo porque cadastrar nao e a tela: e um desvio de quem esta
 * conferindo etiquetas. Antes ele ocupava altura permanente no meio da pagina
 * para uma tarefa que acontece algumas vezes por dia.
 *
 * O dialogo fecha no clique fora. Um formulario a medio preencher e trabalho em
 * andamento, mas o texto digitado nao vem de arquivo nenhum e refaze-lo custa o
 * que custou: nada alem de digitar de novo. O que nao fecha no clique fora e o
 * que consumiu leitura de arquivo — a importacao e a restauracao.
 *
 * O titulo e as acoes ficam no dialogo, e nao no formulario: quem decide o que
 * e cadastro e o que e edicao e o produto recebido, e o dialogo le isso do
 * mesmo lugar.
 *
 * O produto validado vai para `onSubmit`, que decide o que fazer com ele. Para
 * trocar o produto em edicao, remonte o componente com uma `key` diferente.
 */
export default function ProductForm({ product = null, onSubmit, onClose }) {
  const {
    values,
    errors,
    formattedPrice,
    isEditing,
    isSubmitting,
    submitError,
    handleChange,
    handleSubmit,
  } = useProductForm({ product, onSubmit });

  const formId = 'produto-form';

  return (
    <ModalShell
      title={isEditing ? 'Editar produto' : 'Novo produto'}
      subtitle="O nome, o preço, os códigos e o NCM saem impressos e gravados no símbolo."
      width={920}
      onClose={onClose}
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={isSubmitting}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {isEditing ? 'Salvar alterações' : 'Cadastrar produto'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-6">
        <ProductFormFields
          values={values}
          errors={errors}
          formattedPrice={formattedPrice}
          onChange={handleChange}
        />

        {submitError ? <InlineAlert>{submitError}</InlineAlert> : null}
      </form>
    </ModalShell>
  );
}
