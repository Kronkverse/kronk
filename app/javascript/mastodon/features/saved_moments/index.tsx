import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import api from 'mastodon/api';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import { StatusMomentCard } from 'mastodon/components/status_moment_card';
import { AccountHeader } from 'mastodon/features/account_timeline/components/account_header';
import BundleColumnError from 'mastodon/features/ui/components/bundle_column_error';
import Column from 'mastodon/features/ui/components/column';
import { useAccountId } from 'mastodon/hooks/useAccountId';
import { useAccountVisibility } from 'mastodon/hooks/useAccountVisibility';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

interface MomentReactions {
  heart: { me: boolean; others: boolean };
}

const SavedMomentItem: React.FC<{
  moment: ApiStatusJSON;
  onRemove: (id: string) => void;
}> = ({ moment, onRemove }) => {
  const handleRemove = useCallback(() => {
    void api()
      .post(`/api/v1/statuses/${moment.id}/unbookmark`)
      .then(() => {
        onRemove(moment.id);
      })
      .catch(() => {
        // ignore
      });
  }, [moment.id, onRemove]);

  return (
    <div className='saved-moments__item'>
      <StatusMomentCard
        statusId={moment.id}
        contentHtml={moment.content ?? ''}
        reactions={moment.moment_reactions as MomentReactions | undefined}
      />
      <button
        type='button'
        className='saved-moments__unsave'
        onClick={handleRemove}
      >
        <FormattedMessage id='saved_moments.unsave' defaultMessage='Remove' />
      </button>
    </div>
  );
};

export const SavedMoments: React.FC = () => {
  const accountId = useAccountId();
  const { suspended } = useAccountVisibility(accountId);
  const account = useAppSelector((state) =>
    accountId ? state.accounts.get(accountId) : undefined,
  );

  const [moments, setMoments] = useState<ApiStatusJSON[]>([]);
  const [loading, setLoading] = useState(true);

  const isOwner = accountId === me;

  useEffect(() => {
    if (!isOwner) return;
    setLoading(true);
    void api()
      .get<ApiStatusJSON[]>('/api/v1/saved_moments')
      .then((res) => {
        setMoments(res.data);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOwner]);

  const handleRemove = useCallback((id: string) => {
    setMoments((prev) => prev.filter((m) => m.id !== id));
  }, []);

  if (!accountId || !account) {
    return <BundleColumnError multiColumn={false} errorType='routing' />;
  }

  if (suspended || !isOwner) {
    return (
      <Column>
        <ColumnBackButton />
        <AccountHeader accountId={accountId} />
      </Column>
    );
  }

  return (
    <Column>
      <ColumnBackButton />
      <AccountHeader accountId={accountId} />
      <div className='saved-moments'>
        {loading && (
          <div className='saved-moments__loading'>
            <FormattedMessage
              id='saved_moments.loading'
              defaultMessage='Loading…'
            />
          </div>
        )}
        {!loading && moments.length === 0 && (
          <div className='saved-moments__empty'>
            <FormattedMessage
              id='saved_moments.empty'
              defaultMessage='No saved Moments yet'
            />
          </div>
        )}
        {moments.map((moment) => (
          <SavedMomentItem
            key={moment.id}
            moment={moment}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </Column>
  );
};

export default SavedMoments;
