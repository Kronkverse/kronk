import { useState, useEffect, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { apiRequestGet, apiRequestPut } from 'mastodon/api';

// Feed scope: which slice of the network the home timeline pulls from
// (Friends / Friends of Friends / Kommunity). Locked to three values.
// Persists via /api/v1/kronk_settings — see UserSettings#kronk namespace.
//
// This is a picker widget mounted inside the Ӂ menu. The actual feed
// filter is deferred until Kronk::FeatureFlags.feed_scope_enforced flips.

type Scope = 'friends' | 'friends_of_friends' | 'kommunity';

const messages = defineMessages({
  friends: { id: 'feed_scope.friends', defaultMessage: 'Friends' },
  fof: { id: 'feed_scope.fof', defaultMessage: 'Friends of friends' },
  kommunity: { id: 'feed_scope.kommunity', defaultMessage: 'Kommunity' },
});

const OPTIONS: { value: Scope; messageKey: keyof typeof messages }[] = [
  { value: 'friends', messageKey: 'friends' },
  { value: 'friends_of_friends', messageKey: 'fof' },
  { value: 'kommunity', messageKey: 'kommunity' },
];

export const FeedScopePicker = () => {
  const intl = useIntl();
  const [scope, setScope] = useState<Scope>('kommunity');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiRequestGet<{ feed_scope: Scope }>(
          'v1/kronk_settings',
        );
        if (!cancelled && data.feed_scope) setScope(data.feed_scope);
      } catch {
        // Silent — the picker is informational until the gate lands.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const change = useCallback(
    async (next: Scope) => {
      if (saving || next === scope) return;
      const previous = scope;
      setScope(next);
      setSaving(true);
      try {
        await apiRequestPut('v1/kronk_settings', { feed_scope: next });
      } catch {
        setScope(previous);
      } finally {
        setSaving(false);
      }
    },
    [scope, saving],
  );

  return (
    <div className='feed-scope-picker' role='group' aria-label='Feed scope'>
      <p className='feed-scope-picker__heading'>
        <FormattedMessage id='feed_scope.heading' defaultMessage='Feed scope' />
      </p>
      <div className='feed-scope-picker__options'>
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type='button'
            onClick={() => void change(opt.value)}
            className={`feed-scope-picker__option ${scope === opt.value ? 'feed-scope-picker__option--active' : ''}`}
            aria-pressed={scope === opt.value}
          >
            {intl.formatMessage(messages[opt.messageKey])}
          </button>
        ))}
      </div>
    </div>
  );
};
