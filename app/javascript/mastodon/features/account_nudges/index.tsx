import { useState, useCallback, useEffect } from 'react';

import { FormattedMessage } from 'react-intl';

import { apiNudgeAccount, apiGetNudgeStreak } from 'mastodon/api/accounts';
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

  const [sentCount, setSentCount] = useState<number | null>(null);
  const [receivedCount, setReceivedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [canNudge, setCanNudge] = useState(true);

  useEffect(() => {
    if (!accountId || accountId === me) return;
    apiGetNudgeStreak(accountId)
      .then((data) => {
        setSentCount(data.sent_count);
        setReceivedCount(data.received_count);
        setCanNudge(data.can_nudge);
      })
      .catch(() => { /* silent */ });
  }, [accountId]);

  const handleNudge = useCallback(async () => {
    if (!accountId || loading || !canNudge) return;
    setLoading(true);
    try {
      await apiNudgeAccount(accountId);
      setSentCount((c) => (c ?? 0) + 1);
      setNudgeSent(true);
      setCanNudge(false);
    } finally {
      setLoading(false);
    }
  }, [accountId, loading, canNudge]);

  if (!accountId) return <BundleColumnError multiColumn={false} errorType='routing' />;

  return (
    <Column>
      <ColumnBackButton />
      <div className='scrollable'>
        {accountId && <AccountHeader accountId={accountId} hideTabs />}
        {!suspended && account && accountId !== me && (
          <div className='account-nudges'>
            {(sentCount !== null || receivedCount !== null) && (
              <div className='account-nudges__counts'>
                <span className='account-nudges__count-sent'>↑ {sentCount ?? 0}</span>
                <span className='account-nudges__count-received'>↓ {receivedCount ?? 0}</span>
              </div>
            )}

            <button
              className='button account-nudges__button'
              onClick={handleNudge}
              disabled={loading || !canNudge}
            >
              {nudgeSent ? (
                <FormattedMessage id='account_nudges.nudged' defaultMessage='Nudged!' />
              ) : !canNudge ? (
                <FormattedMessage
                  id='account_nudges.waiting'
                  defaultMessage='Waiting for @{acct} to nudge back'
                  values={{ acct: account.acct }}
                />
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
