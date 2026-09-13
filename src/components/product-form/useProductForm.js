import { useCallback, useMemo, useState } from 'react';

import {
  buildNewProduct,
  buildUpdatedProduct,
  validateProduct,
} from '../../domain/services/productService.js';
import { describeStorageError } from '../../storage/storageError.js';

import {
  EMPTY_PRODUCT_FORM_VALUES,
  previewPrice,
  toFormValues,
  toProductFields,
} from './productFormValues.js';

// O contrato guarda o preco em centavos; o controle correspondente na tela se
// chama `price`. A mensagem do contrato precisa cair nesse controle.
const CONTROL_BY_CONTRACT_FIELD = {
  priceInCentavos: 'price',
};

function toControlErrors(fieldErrors) {
  const errors = {};

  for (const [field, message] of Object.entries(fieldErrors)) {
    errors[CONTROL_BY_CONTRACT_FIELD[field] ?? field] = message;
  }

  return errors;
}

function withoutError(errors, field) {
  if (!errors[field]) {
    return errors;
  }

  const { [field]: removed, ...rest } = errors;

  return rest;
}

/**
 * Estado do formulario de produto: o que esta digitado, o que o contrato
 * recusou e o envio em andamento.
 *
 * `product` e lido uma unica vez, na montagem. Para trocar o produto em edicao,
 * o chamador remonta o formulario com uma `key` diferente.
 *
 * `submitError` guarda a gravacao que falhou, ja traduzida para o texto que o
 * usuario le. Os valores digitados continuam nos campos, entao enviar de novo e
 * a nova tentativa.
 */
export function useProductForm({ product = null, onSubmit }) {
  const [values, setValues] = useState(() => toFormValues(product));
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const formattedPrice = useMemo(() => previewPrice(values.price), [values.price]);

  const handleChange = useCallback((field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => withoutError(current, field));
  }, []);

  const reset = useCallback(() => {
    setValues(toFormValues(product));
    setErrors({});
    setSubmitError(null);
  }, [product]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setSubmitError(null);

      const fields = toProductFields(values);
      const candidate = product
        ? buildUpdatedProduct(product, fields)
        : buildNewProduct(fields);

      const { success, product: validated, fieldErrors } = validateProduct(candidate);

      if (!success) {
        setErrors(toControlErrors(fieldErrors));
        return;
      }

      setErrors({});
      setIsSubmitting(true);

      try {
        await onSubmit(validated);

        if (!product) {
          setValues({ ...EMPTY_PRODUCT_FORM_VALUES });
        }
      } catch (error) {
        setSubmitError(describeStorageError(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit, product, values],
  );

  return {
    values,
    errors,
    formattedPrice,
    isEditing: Boolean(product),
    isSubmitting,
    submitError,
    handleChange,
    handleSubmit,
    reset,
  };
}
