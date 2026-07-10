import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import { List as ImmutableList } from 'immutable';

import { apiRequestGet } from 'mastodon/api';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { importFetchedStatuses, importFetchedAccount } from 'mastodon/actions/importer';
import { useAppDispatch } from 'mastodon/store';
import Column from 'mastodon/components/column';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import StatusList from 'mastodon/components/status_list';
import { AccountHeader } from 'mastodon/features/account_timeline/components/account_header';

const messages = defineMessages({
  title: { id: 'sectioned_profile.title', defaultMessage: 'Profile' },
});

interface SectionWithStatuses extends ApiProfileSectionJSON {
  statusIds: ImmutableList<string>;
  loading: boolean;
}

const emptyList = ImmutableList<string>();

export const SectionedProfile = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { acct } = useParams<{ acct?: string }>();

  const [account, setAccount] = useState<ApiAccountJSON | null>(null);
  const [sections, setSections] = useState<SectionWithStatuses[]>([]);
  const [error, setError] = useState<string | null>(null);

  const noopLoadMore = useCallback(() => undefined, []);

  useEffect(() => {
    if (!acct) return;

    let cancelled = false;
    void (async () => {
      try {
        const accountRes = await apiRequestGet<ApiAccountJSON>('v1/accounts/lookup', { acct });
        if (cancelled) return;

        // Hydrate the account into Redux so AccountHeader can find it.
        dispatch(importFetchedAccount(accountRes));
        setAccount(accountRes);

        const sectionList = await apiRequestGet<ApiProfileSectionJSON[]>(
          `v1/accounts/${accountRes.id}/profile/sections`,
        );
        if (cancelled) return;

        const enriched: SectionWithStatuses[] = sectionList.map((s) => ({
          ...s,
          statusIds: emptyList,
          loading: true,
        }));
        setSections(enriched);

        await Promise.all(
          sectionList.map(async (s) => {
            const statuses = await apiRequestGet<ApiStatusJSON[]>(
              `v1/accounts/${accountRes.id}/profile/sections/${s.id}/statuses`,
              { limit: 20 },
            );
            if (cancelled) return;

            dispatch(importFetchedStatuses(statuses));

            setSections((prev) =>
              prev.map((row) =>
                row.id === s.id
                  ? {
                      ...row,
                      statusIds: ImmutableList(statuses.map((st) => st.id)),
                      loading: false,
                    }
                  : row,
              ),
            );
          }),
        );
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [acct, dispatch]);

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnBackButton />

      <div className='scrollable sectioned-profile'>
        {account && <AccountHeader accountId={account.id} />}

        <div className='sectioned-profile__body'>
          {error && (
            <p className='sectioned-profile__error'>
              <FormattedMessage id='sectioned_profile.error' defaultMessage='Could not load profile.' />
              {' '}
              {error}
            </p>
          )}

          {!error && sections.length === 0 && (
            <p className='sectioned-profile__loading'>
              <FormattedMessage id='sectioned_profile.loading' defaultMessage='Loading…' />
            </p>
          )}

          {sections.map((section) => (
            <section key={section.id} className='sectioned-profile__section'>
              <header className='sectioned-profile__section-header'>
                <h3 className='sectioned-profile__section-title'>
                  {section.title ?? section.section_type}
                </h3>
                <small className='sectioned-profile__section-type'>{section.section_type}</small>
              </header>

              <StatusList
                scrollKey={`sectioned_profile:${section.id}`}
                statusIds={section.statusIds}
                isLoading={section.loading}
                hasMore={false}
                onLoadMore={noopLoadMore}
                timelineId={`sectioned_profile:${section.id}`}
                emptyMessage={
                  <FormattedMessage
                    id='sectioned_profile.empty'
                    defaultMessage='Nothing here yet.'
                  />
                }
              />
            </section>
          ))}
        </div>
      </div>
    </Column>
  );
};

export default SectionedProfile;
