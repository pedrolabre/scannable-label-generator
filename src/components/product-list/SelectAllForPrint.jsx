import Checkbox from '../ui/Checkbox.jsx';

export function describeSelectAllForPrint(visibleIds, printSelection) {
  const total = visibleIds.length;
  let marked = 0;

  visibleIds.forEach((id) => {
    if (printSelection.has(id)) {
      marked += 1;
    }
  });

  const checked = total > 0 && marked === total;
  const partial = marked > 0 && marked < total;
  const noun = total === 1 ? 'o produto da lista' : `os ${total} produtos da lista`;

  return {
    total,
    marked,
    checked,
    partial,
    label: checked ? `Desmarcar ${noun} para imprimir` : `Marcar ${noun} para imprimir`,
  };
}

export default function SelectAllForPrint({ state, onChange, className }) {
  return (
    <Checkbox
      label={state.label}
      checked={state.checked}
      disabled={state.total === 0}
      ref={(node) => {
        if (node) {
          node.indeterminate = state.partial;
        }
      }}
      aria-checked={state.partial ? 'mixed' : state.checked}
      onChange={() => onChange(!state.checked)}
      className={className}
      data-select-all-print=""
    />
  );
}
