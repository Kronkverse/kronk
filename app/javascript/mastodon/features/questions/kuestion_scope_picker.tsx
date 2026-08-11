import { useCallback } from 'react';

import type { KuestionVisibilityScope } from 'mastodon/api_types/kuestions';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import type { ReachValue } from 'mastodon/components/reach_dropdown';

// Kuestion answer visibility uses the platform-standard ReachDropdown
// (docs/rebuild/decisions.md 2026-08-09 — one selector everywhere; this
// replaced the bespoke rotary VisibilityDial). Krew is hidden: a Kuestion
// answer isn't krew-scoped and KuestionVisibilityScope has no krew rung, so
// onChange only ever yields one of its values (the cast is safe on that
// ground).
interface Props {
  value: KuestionVisibilityScope;
  onChange: (next: KuestionVisibilityScope) => void;
}

export const KuestionScopePicker: React.FC<Props> = ({ value, onChange }) => {
  const handleChange = useCallback(
    (next: ReachValue) => {
      onChange(next as KuestionVisibilityScope);
    },
    [onChange],
  );

  return (
    <ReachDropdown value={value} onChange={handleChange} />
  );
};
