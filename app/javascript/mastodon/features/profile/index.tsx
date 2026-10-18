import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { fetchAccount, lookupAccount } from 'mastodon/actions/accounts';
import type { ProfileAudience } from 'mastodon/api/profile_sections';
import { Column } from 'mastodon/components/column';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { ProfileBlock } from 'mastodon/components/profile_block';
import { ProfileGatedHint } from 'mastodon/components/profile_gated_hint';
import AccountTimeline from 'mastodon/features/account_timeline';
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
// drum is gone, and `/@:acct/posts` and `/@:acct/mates` redirect here.
//
// The Mates list is off for now, until it is settled who may see whose
// Mates (Tal 2026-10-18). `features/mates_tab` is kept for when it
// comes back.

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

  const accountId = useAppSelector(
    (state) =>
      id ?? (acct ? state.accounts_map[normalizeForLookup(acct)] : undefined),
  );
  const account = useAppSelector((state) =>
    accountId ? state.accounts.get(accountId) : undefined,
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
    isSelf && !gated && !editing && !viewAs,
  );

  const title = account?.display_name
    ? `${account.display_name} (@${handle})`
    : intl.formatMessage(messages.title);

  // Designing, or seeing it as others do, is about the Profile face; the
  // timeline under it would only be in the way (and show your own view).
  const showTimeline = !editing && !viewAs;

  return (
    <Column bindToDocument={!multiColumn} label={title}>
      <ColumnBackButton />

      <Helmet>
        <title>{title}</title>
      </Helmet>

      {accountId ? (
        <ProfileBlock accountId={accountId} minimal={gated} editing={editing} />
      ) : (
        <LoadingIndicator />
      )}

      {gated && accountId ? (
        <ProfileGatedHint accountId={accountId} />
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
