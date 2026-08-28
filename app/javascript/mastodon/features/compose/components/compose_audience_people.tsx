import { useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { List as ImmutableList } from 'immutable';

import {
  changeComposeAudienceGrants,
  changeComposeAudienceExcludes,
} from 'mastodon/actions/compose';
import type { StatusVisibility } from 'mastodon/api_types/statuses';
import type { AccountLite } from 'mastodon/components/account_multi_select';
import { AccountMultiSelect } from 'mastodon/components/account_multi_select';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

// Per-post audience "people layer" in the composer
// (docs/rebuild/per_post_audience.md). On top of the reach tier, the author
// can let specific people IN (grants) or keep specific people OUT (excludes) —
// but only on the gated scopes. A `public` post can't be restricted, so this
// whole control is hidden for it. "Keep out" is meaningless on `self_only`
// (the audience is only the author), so it shows for mates/orbit only.

const LADDER: readonly ReachValue[] = ['self_only', 'mates', 'orbit', 'public'];

const messages = defineMessages({
  addLabel: {
    id: 'compose.audience.add_label',
    defaultMessage: 'Also let in',
  },
  addHint: {
    id: 'compose.audience.add_hint',
    defaultMessage:
      'People who can see this even if they’re not in your reach.',
  },
  removeLabel: {
    id: 'compose.audience.remove_label',
    defaultMessage: 'Keep out',
  },
  removeHint: {
    id: 'compose.audience.remove_hint',
    defaultMessage:
      'People who won’t see this, even though your reach includes them.',
  },
});

const toAccounts = (list: unknown): AccountLite[] =>
  ((list ?? ImmutableList()) as ImmutableList<AccountLite>).toArray();

interface Props {
  disabled?: boolean;
}

export const ComposeAudiencePeople: React.FC<Props> = ({
  disabled = false,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();

  const privacy = useAppSelector(
    (state) => state.compose.get('privacy') as StatusVisibility,
  );
  const grants = useAppSelector((state) =>
    toAccounts(state.compose.get('audience_grants')),
  );
  const excludes = useAppSelector((state) =>
    toAccounts(state.compose.get('audience_excludes')),
  );

  const value: ReachValue = useMemo(
    () =>
      LADDER.includes(privacy as ReachValue)
        ? (privacy as ReachValue)
        : 'public',
    [privacy],
  );

  const handleGrants = useCallback(
    (next: AccountLite[]) => {
      dispatch(changeComposeAudienceGrants(next));
    },
    [dispatch],
  );

  const handleExcludes = useCallback(
    (next: AccountLite[]) => {
      dispatch(changeComposeAudienceExcludes(next));
    },
    [dispatch],
  );

  // Public isn't restrictable — no control at all.
  if (value === 'public') {
    return null;
  }

  return (
    <div className='compose-audience-people'>
      <div className='compose-audience-people__group'>
        <span className='compose-audience-people__label'>
          {intl.formatMessage(messages.addLabel)}
        </span>
        <span className='compose-audience-people__hint'>
          {intl.formatMessage(messages.addHint)}
        </span>
        <AccountMultiSelect
          value={grants}
          onChange={handleGrants}
          disabled={disabled}
        />
      </div>

      {/* "Keep out" only makes sense when the tier admits others — not on
          self_only (audience = just the author). */}
      {(value === 'mates' || value === 'orbit') && (
        <div className='compose-audience-people__group'>
          <span className='compose-audience-people__label'>
            {intl.formatMessage(messages.removeLabel)}
          </span>
          <span className='compose-audience-people__hint'>
            {intl.formatMessage(messages.removeHint)}
          </span>
          <AccountMultiSelect
            value={excludes}
            onChange={handleExcludes}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
};
