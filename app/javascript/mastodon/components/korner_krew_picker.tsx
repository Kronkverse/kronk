// Single-select "which krew" picker — for korner surfaces scoped to one
// krew (a Moment has a single krew_id). Fetches the viewer's own krews
// (GET /api/v1/krews?scope=mine) on mount. Prop-driven and local-state
// only — unlike the multi-select, compose-store pickers in
// features/compose. Render it beneath a KornerVisibilityPicker when the
// chosen scope is `krew`.

import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import type { ApiKrewJSON } from 'mastodon/api/krew';
import { apiGetKrews } from 'mastodon/api/krew';

interface KornerKrewPickerProps {
  value: string | null;
  onChange: (krewId: string) => void;
  disabled?: boolean;
  className?: string;
}

export const KornerKrewPicker: React.FC<KornerKrewPickerProps> = ({
  value,
  onChange,
  disabled,
  className,
}) => {
  const [krews, setKrews] = useState<ApiKrewJSON[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGetKrews({ scope: 'mine', limit: 100 })
      .then((data) => {
        if (cancelled) return;
        setKrews(data.filter((krew) => !krew.archived));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rootClass = `korner-krew-picker ${className ?? ''}`.trim();

  if (loading) {
    return (
      <div className={rootClass}>
        <span className='korner-krew-picker__status'>
          <FormattedMessage
            id='korner.krew_picker.loading'
            defaultMessage='Loading your krews…'
          />
        </span>
      </div>
    );
  }

  if (krews.length === 0) {
    return (
      <div className={rootClass}>
        <span className='korner-krew-picker__status'>
          <FormattedMessage
            id='korner.krew_picker.empty'
            defaultMessage="You're not in any krews yet."
          />
        </span>
      </div>
    );
  }

  return (
    <div className={rootClass} role='radiogroup'>
      {krews.map((krew) => (
        <KrewOption
          key={krew.id}
          krew={krew}
          active={value === krew.id}
          disabled={disabled}
          onSelect={onChange}
        />
      ))}
    </div>
  );
};

const KrewOption = ({
  krew,
  active,
  disabled,
  onSelect,
}: {
  krew: ApiKrewJSON;
  active: boolean;
  disabled?: boolean;
  onSelect: (krewId: string) => void;
}) => {
  const handleClick = useCallback(() => {
    onSelect(krew.id);
  }, [onSelect, krew.id]);

  return (
    <button
      type='button'
      role='radio'
      aria-checked={active}
      className={`korner-krew-picker__option${
        active ? ' korner-krew-picker__option--active' : ''
      }`}
      onClick={handleClick}
      disabled={disabled}
    >
      <span className='korner-krew-picker__name'>{krew.name}</span>
      <span className='korner-krew-picker__count'>
        <FormattedMessage
          id='korner.krew_picker.members'
          defaultMessage='{count, plural, one {# member} other {# members}}'
          values={{ count: krew.member_count }}
        />
      </span>
    </button>
  );
};
