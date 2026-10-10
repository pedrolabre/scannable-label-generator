import { useState } from 'react';

import { CUT_GUIDES } from '../../domain/services/cutGuide.js';
import { useCutGuide, useLabelSettingsStore } from '../../store/useLabelSettingsStore.js';

import InlineAlert from '../ui/InlineAlert.jsx';
import SegmentedControl from '../ui/SegmentedControl.jsx';

const OPTIONS = Object.freeze([
  { value: CUT_GUIDES.LIGHT, label: 'Clara' },
  { value: CUT_GUIDES.STRONG, label: 'Destacada' },
]);

export default function SheetCutGuidePicker({ className }) {
  const cutGuide = useCutGuide();
  const update = useLabelSettingsStore((state) => state.update);
  const [error, setError] = useState(null);

  function handleChange(next) {
    try {
      update({ cutGuide: next });
      setError(null);
    } catch (failure) {
      setError(failure?.message ?? 'Não foi possível guardar a borda de corte.');
    }
  }

  return (
    <div className={className} data-cut-guide-picker="">
      <SegmentedControl
        legend="Borda de corte"
        name="borda-corte"
        options={OPTIONS}
        value={cutGuide}
        onChange={handleChange}
      />
      {error ? <InlineAlert className="mt-2">{error}</InlineAlert> : null}
    </div>
  );
}
