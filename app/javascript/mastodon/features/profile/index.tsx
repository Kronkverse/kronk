import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useLocation, useParams } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { fetchAccount, lookupAccount } from 'mastodon/actions/accounts';
import type { ProfileAudience } from 'mastodon/api/profile_sections';
import { Column } from 'mastodon/components/column';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { ProfileBlock } from 'mastodon/components/profile_block';
import { ProfileGatedHint } from 'mastodon/components/profile_gated_hint';
import AccountTimeline from 'mastodon/features/account_timeline';
import { MatesFace } from 'mastodon/features/mates_tab';
import { MatesHidden } from 'mastodon/features/mates_tab/hidden';
import { ProfileFace } from 'mastodon/features/profile_shelves';
import { ViewAsBar } from 'mastodon/features/profile_shelves/components/view_as_bar';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { me } from 'mastodon/initial_state';
import { normalizeForLookup } from 'mastodon/reducers/accounts_map';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

// The profile space. Every `/@:acct` URL that matters lands here: the
// block (cover, photo, name, counts, bio), the Profile face under it
// (answers, shelves), then their timeline under that. One page, read
// top to bottom (Tal 2026-10-18); the old Profile / Timeline / Mates
// drum is gone, and `/@:acct/posts` redirects here.
//
// `/@:acct/mates` is the same page with the Mates list under the block
// in place of the face and timeline, reached from the Mates count. Only
// the member and their Mates see it (Tal 2026-10-26); anyone else gets
// a line saying so, and an empty list from the server.

const messages = defineMessages({
  title: { id: 'column.profile', defaultMessage: 'Profile' },
  edit: { id: 'profile_space.design', defaultMessage: 'Design your profile' },
});

interface RouteParams {
  acct?: string;
  id?: string;
}

const ProfileSpace: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { acct, id } = useParams<RouteParams>();
  const { pathname } = useLocation();
  const onMates = !!acct && pathname.endsWith('/mates');

  const accountId = useAppSelector(
    (state) =>
      id ?? (acct ? state.accounts_map[normalizeForLookup(acct)] : undefined),
  );
  const account = useAppSelector((state) =>
    accountId ? state.accounts.get(accountId) : undefined,
  );
  const relationship = useAppSelector((state) =>
    accountId ? state.relationships.get(accountId) : undefined,
  );
  const gated = useAppSelector(
    (state) =>
      !!accountId &&
      accountId !== me &&
      state.relationships.get(accountId)?.profile_visible === false,
  );

  useEffect(() => {
    if (accountId) {
      dispatch(fetchAccount(accountId));
    } else if (acct) {
      dispatch(lookupAccount(acct));
    }
  }, [dispatch, accountId, acct]);

  // Editing your own profile: the block (cover, photo, name) and the
  // Profile face below it (bio, answers, shelves) turn editable in place.
  // Started from the Ж menu, like Edit on any other page; finished with
  // Save on the face.
  const isSelf = !!accountId && accountId === me;
  const [editing, setEditing] = useState(false);

  // Seeing your own profile as a circle of others sees it (Tal 2026-10-15:
  // so people can check who can see what). Started from a button while
  // designing, and ends back in designing. Null is as yourself.
  const [viewAs, setViewAs] = useState<ProfileAudience | null>(null);

  // Someone else's profile is never being edited.
  useEffect(() => {
    if (!isSelf) {
      setEditing(false);
      setViewAs(null);
    }
  }, [isSelf, accountId]);

  // The canonical acct. Before the lookup resolves we only have whatever
  // was in the URL, which is the same string.
  const handle = account?.acct ?? acct ?? '';

  const startEditing = useCallback(() => {
    setViewAs(null);
    setEditing(true);
  }, []);
  // From designing: Mates first, the circle that sees the most besides you.
  const startViewAs = useCallback(() => {
    setEditing(false);
    setViewAs('mates');
  }, []);
  // The bar picks another circle, or (null) goes back to designing.
  const changeViewAs = useCallback((audience: ProfileAudience | null) => {
    setViewAs(audience);
    if (!audience) setEditing(true);
  }, []);

  // Only on your own profile, and only until you're editing: the way out
  // is Save, on the page (Tal 2026-10-13).
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.edit),
      icon: EditIcon,
      iconId: 'edit',
    },
    startEditing,
    isSelf && !gated && !editing && !viewAs && !onMates,
  );

  const title = account?.display_name
    ? `${account.display_name} (@${handle})`
    : intl.formatMessage(messages.title);

  // Designing, or seeing it as others do, is about the Profile face; the
  // timeline under it would only be in the way (and show your own view).
  const showTimeline = !editing && !viewAs;

  // Who may see the Mates list: you, and your Mates unless you hide your
  // connections. The same rule as the server's and as the Mates count's
  // link in ProfileBlock. Until the relationship arrives, wait.
  const canSeeMates =
    isSelf || (!!relationship?.mate && !account?.hide_collections);
  const matesUnknown = !isSelf && !!me && !relationship;
  // An empty display name falls back to the username.
  const backLabel = account
    ? account.display_name !== ''
      ? account.display_name
      : account.username
    : handle;

  return (
    <Column bindToDocument={!multiColumn} label={title}>
      <ColumnBackButton />

      <Helmet>
        <title>{title}</title>
      </Helmet>

      {accountId ? (
        <ProfileBlock
          accountId={accountId}
          minimal={gated}
          editing={editing && !onMates}
        />
      ) : (
        <LoadingIndicator />
      )}

      {gated && accountId ? (
        <ProfileGatedHint accountId={accountId} />
      ) : onMates ? (
        !accountId || matesUnknown ? (
          <LoadingIndicator />
        ) : canSeeMates ? (
          <MatesFace acct={handle} backLabel={backLabel} />
        ) : (
          <MatesHidden acct={handle} backLabel={backLabel} />
        )
      ) : (
        <>
          {viewAs && <ViewAsBar value={viewAs} onChange={changeViewAs} />}
          <ProfileFace
            acct={handle}
            editing={editing}
            onEditingChange={setEditing}
            onViewAs={startViewAs}
            viewAs={viewAs}
          />
          {showTimeline && handle && (
            // AccountTimeline is a connected route component: it reads
            // the handle off `params`, which it normally gets from the
            // router.
            <AccountTimeline
              embedded
              multiColumn={multiColumn}
              params={{ acct: handle, id: undefined, tagged: undefined }}
            />
          )}
        </>
      )}
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default ProfileSpace;
