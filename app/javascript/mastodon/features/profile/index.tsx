import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useLocation, useParams } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { fetchAccount, lookupAccount } from 'mastodon/actions/accounts';
import type { ProfileAudience } from 'mastodon/api/profile_sections';
import { Column } from 'mastodon/components/column';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import { FeedDrum } from 'mastodon/components/feed_drum';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { ProfileBlock } from 'mastodon/components/profile_block';
import { ProfileGatedHint } from 'mastodon/components/profile_gated_hint';
import type { ScopeTitleFace } from 'mastodon/components/scope_title';
import { ScopeTitle } from 'mastodon/components/scope_title';
import AccountTimeline from 'mastodon/features/account_timeline';
import { MatesFace } from 'mastodon/features/mates_tab';
import { ProfileFace } from 'mastodon/features/profile_shelves';
import { ViewAsBar } from 'mastodon/features/profile_shelves/components/view_as_bar';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { me } from 'mastodon/initial_state';
import { normalizeForLookup } from 'mastodon/reducers/accounts_map';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

// The profile space — one block, three faces, turned on the drum.
//
// Every `/@:acct` URL that matters lands here: the Profile face at
// `/@:acct`, Timeline at `/@:acct/posts`, Mates at `/@:acct/mates`.
// The block is rendered once, above the drum, so it does not move when
// the face turns; the chevrons, a swipe, or the arrow keys step through
// the faces and push the matching URL.
//
// This replaces the seven-glyph `ProfileNav` strip (deleted) and the
// six separate route components that each drew their own chrome. Media,
// Featured, Posts-and-replies and the per-person Nudges thread are gone
// as surfaces — see docs/spaces/profile.md § Deleted, not relocated.

const messages = defineMessages({
  title: { id: 'column.profile', defaultMessage: 'Profile' },
  profile: { id: 'profile_space.profile', defaultMessage: 'Profile' },
  profileDesc: {
    id: 'profile_space.profile_desc',
    defaultMessage: 'Who they are',
  },
  timeline: { id: 'profile_space.timeline', defaultMessage: 'Timeline' },
  timelineDesc: {
    id: 'profile_space.timeline_desc',
    defaultMessage: 'What they have posted',
  },
  mates: { id: 'profile_space.mates', defaultMessage: 'Mates' },
  matesDesc: {
    id: 'profile_space.mates_desc',
    defaultMessage: 'Who they are Mates with',
  },
  cycle: {
    id: 'profile_space.cycle',
    defaultMessage: 'Change what you see on this profile',
  },
  edit: { id: 'profile_space.design', defaultMessage: 'Design your profile' },
});

type Face = 'profile' | 'timeline' | 'mates';

const ORDER: Face[] = ['profile', 'timeline', 'mates'];

const faceFromPath = (pathname: string): Face => {
  if (pathname.endsWith('/posts')) return 'timeline';
  if (pathname.endsWith('/mates')) return 'mates';
  return 'profile';
};

const pathForFace = (acct: string, face: Face): string => {
  switch (face) {
    case 'timeline':
      return `/@${acct}/posts`;
    case 'mates':
      return `/@${acct}/mates`;
    default:
      return `/@${acct}`;
  }
};

interface RouteParams {
  acct?: string;
  id?: string;
}

const ProfileSpace: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const history = useHistory();
  const location = useLocation();
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

  const face = faceFromPath(location.pathname);

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

  // Someone else's profile, or another face, is never being edited.
  useEffect(() => {
    if (!isSelf || face !== 'profile') {
      setEditing(false);
      setViewAs(null);
    }
  }, [isSelf, face, accountId]);

  // Face links need the canonical acct. Before the lookup resolves we
  // only have whatever was in the URL, which is the same string.
  const handle = account?.acct ?? acct ?? '';

  const handleFace = useCallback(
    (next: string) => {
      if (!handle) return;
      // A location object, not a path string with a query — the router
      // wrapper mangles `push('/path?x')` into the pathname.
      history.push({ pathname: pathForFace(handle, next as Face) });
    },
    [history, handle],
  );

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

  // Only on your own Profile face, and only until you're editing: the way
  // out is Save, on the page (Tal 2026-10-13). Timeline and Mates have
  // nothing to edit, so no moon there.
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.edit),
      icon: EditIcon,
      iconId: 'edit',
    },
    startEditing,
    isSelf && !gated && face === 'profile' && !editing && !viewAs,
  );

  const faces: ScopeTitleFace[] = useMemo(
    () => [
      {
        key: 'profile',
        label: intl.formatMessage(messages.profile),
        desc: intl.formatMessage(messages.profileDesc),
      },
      {
        key: 'timeline',
        label: intl.formatMessage(messages.timeline),
        desc: intl.formatMessage(messages.timelineDesc),
      },
      {
        key: 'mates',
        label: intl.formatMessage(messages.mates),
        desc: intl.formatMessage(messages.matesDesc),
      },
    ],
    [intl],
  );

  const title = account?.display_name
    ? `${account.display_name} (@${handle})`
    : intl.formatMessage(messages.title);

  let body: React.ReactNode = null;

  if (gated && accountId) {
    body = <ProfileGatedHint accountId={accountId} />;
  } else if (face === 'timeline') {
    // AccountTimeline is a connected route component: it reads the
    // handle off `params`, which it normally gets from the router.
    body = (
      <AccountTimeline
        embedded
        multiColumn={multiColumn}
        params={{ acct: handle, id: undefined, tagged: undefined }}
      />
    );
  } else if (face === 'mates') {
    body = <MatesFace acct={handle} />;
  } else {
    body = (
      <>
        {viewAs && <ViewAsBar value={viewAs} onChange={changeViewAs} />}
        <ProfileFace
          acct={handle}
          editing={editing}
          onEditingChange={setEditing}
          onViewAs={startViewAs}
          viewAs={viewAs}
        />
      </>
    );
  }

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

      {!gated && (
        <ScopeTitle
          ariaLabel={intl.formatMessage(messages.cycle)}
          faces={faces}
          value={face}
          onChange={handleFace}
        />
      )}

      {gated ? (
        body
      ) : (
        <FeedDrum reach={face} order={ORDER} onScopeChange={handleFace}>
          {body}
        </FeedDrum>
      )}
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default ProfileSpace;
