import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useParams } from 'react-router-dom';

import { apiRequestGet, apiRequestPost } from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import type { ApiRelationshipJSON } from 'mastodon/api_types/relationships';
import Column from 'mastodon/components/column';
import ColumnHeader from 'mastodon/components/column_header';
import { useIdentity } from 'mastodon/identity_context';

const messages = defineMessages({
  title: { id: 'connections.title', defaultMessage: 'Connections' },
});

interface FollowRequestJSON extends ApiAccountJSON {}

// Kronk profile subview at /@:acct/connections. When viewing your own
// profile, it surfaces pending follow requests (Kronk defaults new
// accounts to locked so this is meaningful) + your followers list.
// Other users' pages just show followers/following counts.
export const Connections = () => {
  const intl = useIntl();
  const { acct } = useParams<{ acct?: string }>();
  const identity = useIdentity();

  const [account, setAccount] = useState<ApiAccountJSON | null>(null);
  const [requests, setRequests] = useState<FollowRequestJSON[]>([]);
  const [followers, setFollowers] = useState<ApiAccountJSON[]>([]);
  const [following, setFollowing] = useState<ApiAccountJSON[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const viewingOwnProfile =
    account &&
    identity.accountId &&
    String(account.id) === String(identity.accountId);

  useEffect(() => {
    if (!acct) return;
    let cancelled = false;

    void (async () => {
      try {
        const accountRes = await apiRequestGet<ApiAccountJSON>(
          'v1/accounts/lookup',
          { acct },
        );
        if (cancelled) return;
        setAccount(accountRes);

        const [followersRes, followingRes] = await Promise.all([
          apiRequestGet<ApiAccountJSON[]>(
            `v1/accounts/${accountRes.id}/followers`,
            { limit: 20 },
          ),
          apiRequestGet<ApiAccountJSON[]>(
            `v1/accounts/${accountRes.id}/following`,
            { limit: 20 },
          ),
        ]);
        if (cancelled) return;
        setFollowers(followersRes);
        setFollowing(followingRes);

        // Follow requests are viewer-scoped — only load when viewing own profile.
        if (String(accountRes.id) === String(identity.accountId)) {
          const requestsRes = await apiRequestGet<FollowRequestJSON[]>(
            'v1/follow_requests',
            { limit: 40 },
          );
          if (cancelled) return;
          setRequests(requestsRes);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [acct, identity.accountId]);

  const authorize = async (id: string) => {
    setBusy(id);
    try {
      await apiRequestPost<ApiRelationshipJSON>(
        `v1/follow_requests/${id}/authorize`,
        {},
      );
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const reject = async (id: string) => {
    setBusy(id);
    try {
      await apiRequestPost<ApiRelationshipJSON>(
        `v1/follow_requests/${id}/reject`,
        {},
      );
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const handleAuthorize = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const id = e.currentTarget.dataset.reqId;
      if (id) void authorize(id);
    },
    // authorize / reject are recreated each render but their identity is
    // captured here; that's fine for the lint rule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleReject = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const id = e.currentTarget.dataset.reqId;
      if (id) void reject(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const renderAccountRow = (a: ApiAccountJSON, actions?: React.ReactNode) => (
    <li
      key={a.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 0.75rem',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-medium, 8px)',
        marginBottom: '0.4rem',
        background: 'var(--surface-elevated)',
      }}
    >
      {a.avatar && (
        <img
          src={a.avatar}
          alt=''
          style={{ width: 40, height: 40, borderRadius: '50%' }}
        />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{a.display_name || a.username}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          @{a.acct}
        </div>
      </div>
      {actions}
    </li>
  );

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnHeader
        title={
          account
            ? `${account.display_name || account.username} — Connections`
            : intl.formatMessage(messages.title)
        }
        showBackButton
      />

      <div className='scrollable' style={{ padding: '1rem' }}>
        {error && (
          <p style={{ color: 'var(--warning-red, tomato)' }}>{error}</p>
        )}

        {viewingOwnProfile && (
          <>
            <h3 style={{ marginTop: 0 }}>
              <FormattedMessage
                id='connections.requests'
                defaultMessage='Follow requests'
              />
              {requests.length > 0 && (
                <span
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.1rem 0.5rem',
                    borderRadius: 'var(--radius-round, 999px)',
                    fontSize: '0.75rem',
                    background: 'var(--accent)',
                    color: 'var(--surface-primary)',
                  }}
                >
                  {requests.length}
                </span>
              )}
            </h3>

            {requests.length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>
                <FormattedMessage
                  id='connections.no_requests'
                  defaultMessage='No pending follow requests.'
                />
              </p>
            )}

            <ul style={{ padding: 0, listStyle: 'none' }}>
              {requests.map((r) =>
                renderAccountRow(
                  r,
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type='button'
                      data-req-id={r.id}
                      onClick={handleAuthorize}
                      disabled={busy === r.id}
                      style={{
                        padding: '0.35rem 0.7rem',
                        border: 'none',
                        borderRadius: 'var(--radius-medium, 8px)',
                        background: 'var(--accent)',
                        color: 'var(--surface-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <FormattedMessage
                        id='connections.authorize'
                        defaultMessage='Accept'
                      />
                    </button>
                    <button
                      type='button'
                      data-req-id={r.id}
                      onClick={handleReject}
                      disabled={busy === r.id}
                      style={{
                        padding: '0.35rem 0.7rem',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-medium, 8px)',
                        background: 'var(--surface-elevated)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <FormattedMessage
                        id='connections.reject'
                        defaultMessage='Reject'
                      />
                    </button>
                  </div>,
                ),
              )}
            </ul>
          </>
        )}

        <h3>
          <FormattedMessage
            id='connections.followers'
            defaultMessage='Followers'
          />
        </h3>
        {followers.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            <FormattedMessage
              id='connections.no_followers'
              defaultMessage='No followers yet.'
            />
          </p>
        )}
        <ul style={{ padding: 0, listStyle: 'none' }}>
          {followers.map((f) => renderAccountRow(f))}
        </ul>

        <h3>
          <FormattedMessage
            id='connections.following'
            defaultMessage='Following'
          />
        </h3>
        {following.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            <FormattedMessage
              id='connections.no_following'
              defaultMessage='Not following anyone yet.'
            />
          </p>
        )}
        <ul style={{ padding: 0, listStyle: 'none' }}>
          {following.map((f) => renderAccountRow(f))}
        </ul>
      </div>
    </Column>
  );
};

export default Connections;
