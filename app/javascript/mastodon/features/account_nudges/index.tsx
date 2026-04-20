import { useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import RoomServiceIcon from '@/material-icons/400-24px/room_service.svg?react';
import { apiNudgeAccount } from 'mastodon/api/accounts';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import { AccountHeader } from 'mastodon/features/account_timeline/components/account_header';
import BundleColumnError from 'mastodon/features/ui/components/bundle_column_error';
import Column from 'mastodon/features/ui/components/column';
import { useAccountId } from 'mastodon/hooks/useAccountId';
import { useAccountVisibility } from 'mastodon/hooks/useAccountVisibility';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

const AccountNudges: React.FC = () => {
  const accountId = useAccountId();
  const { suspended } = useAccountVisibility(accountId);
  const account = useAppSelector((state) =>
    accountId ? state.accounts.get(accountId) : undefined,
  );

  const [streak, setStreak] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);

  const handleNudge = useCallback(async () => {
    if (!accountId || loading || nudgeSent) return;
    setLoading(true);
    try {
      const result = await apiNudgeAccount(accountId);
      setStreak(result.streak);
      setNudgeSent(true);
    } finally {
      setLoading(false);
    }
  }, [accountId, loading, nudgeSent]);

  if (!accountId) return <BundleColumnError multiColumn={false} errorType='routing' />;

  return (
    <Column>
      <ColumnBackButton />
      <div className='scrollable'>
        {accountId && <AccountHeader accountId={accountId} hideTabs />}
        {!suspended && account && accountId !== me && (
          <div className='account-nudges'>
            <div className='account-nudges__icon'>
              <RoomServiceIcon />
            </div>
            <h3 className='account-nudges__title'>
              <FormattedMessage
                id='account_nudges.title'
                defaultMessage='Nudges with @{acct}'
                values={{ acct: account.acct }}
              />
            </h3>
            {streak !== null && (
              <p className='account-nudges__streak'>
                <FormattedMessage
                  id='account_nudges.streak'
                  defaultMessage='{count, plural, one {# nudge exchanged} other {# nudges exchanged}}'
                  values={{ count: streak }}
                />
              </p>
            )}
            <button
              className='button account-nudges__button'
              onClick={handleNudge}
              disabled={loading || nudgeSent}
            >
              {nudgeSent ? (
                <FormattedMessage id='account_nudges.nudged' defaultMessage='Nudged!' />
              ) : (
                <FormattedMessage
                  id='account_nudges.nudge'
                  defaultMessage='Nudge @{acct}'
                  values={{ acct: account.acct }}
                />
              )}
            </button>
          </div>
        )}
      </div>
    </Column>
  );
};

export default AccountNudges;
