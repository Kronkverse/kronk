import { useEffect, useMemo, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useParams, useHistory, useLocation } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import PhotoCameraIcon from '@/material-icons/400-24px/photo_camera.svg?react';
import { changeComposeKrewTargets } from 'mastodon/actions/compose';
import { apiDeleteAttachment } from 'mastodon/api/attachments';
import type { ApiAttachmentJSON } from 'mastodon/api/attachments';
import {
  apiGetKrew,
  apiGetKrewMembers,
  apiGetKrewActivity,
  apiSetKrewImage,
  apiJoinKrew,
  apiWithdrawKrewJoinRequest,
  apiGetKrewJoinRequests,
  apiAcceptKrewJoinRequest,
  apiDeclineKrewJoinRequest,
  apiInviteToKrew,
  apiAttachKorner,
  isKrewKornerSlug,
} from 'mastodon/api/krew';
import type {
  ApiKrewActivityJSON,
  ApiKrewJSON,
  ApiKrewJoinRequestJSON,
} from 'mastodon/api/krew';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { AccountMultiSelect } from 'mastodon/components/account_multi_select';
import type { AccountLite } from 'mastodon/components/account_multi_select';
import { AttachmentSection } from 'mastodon/components/attachment_section';
import { Avatar } from 'mastodon/components/avatar';
import { Icon } from 'mastodon/components/icon';
import { SpaceShelf } from 'mastodon/components/space_shelf';
import { Stage } from 'mastodon/components/stage';
import { KuddleFrame } from 'mastodon/features/live/kuddle_frame';
import { HomeKuestions } from 'mastodon/features/questions/home_kuestions';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useKorner } from 'mastodon/hooks/useKorner';
import { createAccountFromServerJSON } from 'mastodon/models/account';
import { useAppDispatch } from 'mastodon/store';

import { KrewAccessMark, requirementSummary } from './krew_access_mark';
import { KrewAlbums } from './krew_albums';
import { KrewChat } from './krew_chat';
import { KrewEvents } from './krew_events';
import { KrewPhotoField } from './krew_photo_field';
import { KrewPosts } from './krew_posts';
import { KrewProjekts } from './krew_projekts';
import { KrewSpaceIcon } from './krew_space_icon';

// Krew page (/hub/krew/:id): identity and the faces, then the Krew's
// spaces, its projekts, its chat, any Kuddle Konnected here as a call
// frame, and its posts (docs/spaces/krew.md, The surfaces). Settings lives
// on the floating space menu. A section shows only once the Krew has that
// thing (Tal, 2026-10-31): a Krew with nothing Konnected is its header, the
// Konnect tile and its posts. The tiles for the projekts, the chat and the
// Kuddle scroll to their section.

// The grid's tiles open their space below it, one at a time, and close
// again on a second tap (decisions.md, 2026-10-18): its albums, its
// events. Only spaces with a Krew part get a tile (KREW_PAGE_SPACES); a
// Krew that turned on another space keeps it, but it has nothing to show
// here yet. People opens from the faces under the Krew's name.
type PanelSpace =
  | 'albutts'
  | 'kalendar'
  | 'art'
  | 'cinema'
  | 'booth'
  | 'kronikles';
type OpenSpace = PanelSpace | 'people' | null;

const messages = defineMessages({
  title: { id: 'krew.detail.title', defaultMessage: 'Krew' },
  loading: { id: 'krew.detail.loading', defaultMessage: 'Loading…' },
  inThisKrew: {
    id: 'krew.detail.in_this_krew',
    defaultMessage: 'In this Krew',
  },
  facesCount: {
    id: 'krew.detail.faces_count',
    defaultMessage: '{count} in this Krew',
  },
  facesAsking: {
    id: 'krew.detail.faces_asking',
    defaultMessage: '{count} asking to join',
  },
  join: { id: 'krew.detail.join', defaultMessage: 'Join' },
  askToJoin: { id: 'krew.detail.ask_to_join', defaultMessage: 'Ask to join' },
  askHint: {
    id: 'krew.detail.ask_hint',
    defaultMessage: 'Anyone in this Krew can let you in.',
  },
  asked: {
    id: 'krew.detail.asked',
    defaultMessage:
      "You've asked to join. You'll get a nudge when someone lets you in.",
  },
  withdraw: {
    id: 'krew.detail.withdraw',
    defaultMessage: 'Take back my request',
  },
  needsHeading: {
    id: 'krew.detail.needs_heading',
    defaultMessage: 'To join:',
  },
  inviteOnlyHint: {
    id: 'krew.detail.invite_only_hint',
    defaultMessage: 'You need an invite from someone in this Krew to join.',
  },
  invitePeople: {
    id: 'krew.detail.invite_people',
    defaultMessage: 'Invite people',
  },
  inviteHint: {
    id: 'krew.detail.invite_people_hint',
    defaultMessage:
      'They get a request in their Nudges. Nobody joins without choosing to.',
  },
  sendInvites: {
    id: 'krew.detail.send_invites',
    defaultMessage: 'Send invites',
  },
  invitesSent: {
    id: 'krew.detail.invites_sent',
    defaultMessage:
      '{count, plural, one {Invite sent.} other {# invites sent.}}',
  },
  invitesNone: {
    id: 'krew.detail.invites_none',
    defaultMessage: "Nobody new to invite: they're already in, or can't be.",
  },
  cancel: { id: 'krew.detail.cancel', defaultMessage: 'Cancel' },
  requests: {
    id: 'krew.detail.requests',
    defaultMessage: 'Asking to join',
  },
  accept: { id: 'krew.detail.request_accept', defaultMessage: 'Let them in' },
  decline: { id: 'krew.detail.request_decline', defaultMessage: 'Decline' },
  spaces: { id: 'krew.detail.spaces', defaultMessage: 'Spaces' },
  projektsTile: { id: 'krew.detail.tile.projekts', defaultMessage: 'Projekts' },
  chatTile: { id: 'krew.detail.tile.chat', defaultMessage: 'Chat' },
  kuestions: { id: 'krew.detail.kuestions', defaultMessage: 'Kuestions' },
  kuddles: {
    id: 'krew.detail.kuddles',
    defaultMessage: '{count, plural, one {Kuddle} other {Kuddles}}',
  },
  konnect: { id: 'krew.detail.konnect', defaultMessage: 'Konnect' },
  editKrew: { id: 'krew.detail.edit', defaultMessage: 'Edit Krew' },
  changeImage: {
    id: 'krew.detail.change_image',
    defaultMessage: 'Change photo',
  },
  newEvent: {
    id: 'krew.events.new',
    defaultMessage: 'New event for this Krew',
  },
  archived: { id: 'krew.detail.archived', defaultMessage: 'archived' },
  postTo: { id: 'krew.detail.post_to', defaultMessage: 'Post to {krew}' },
  newAlbum: { id: 'krew.detail.new_album', defaultMessage: 'New Krew album' },
});

const initial = (name: string): string => {
  const first = name.trim().charAt(0);
  return first.length === 0 ? 'K' : first.toUpperCase();
};

// Someone in the Krew, in the People list.
const PersonRow: React.FC<{ account: ApiAccountJSON }> = ({ account }) => {
  const model = createAccountFromServerJSON(account);
  return (
    <li className='krew-detail__person'>
      <Link to={`/@${account.acct}`} className='krew-detail__request-who'>
        <Avatar account={model} size={36} />
        <span className='krew-detail__request-name'>
          {model.display_name || account.username}
        </span>
        <span className='krew-detail__request-acct'>@{account.acct}</span>
      </Link>
    </li>
  );
};

// How many faces show under the name before "+N".
const FACES_SHOWN = 5;

// The faces under the Krew's name: a few of the people in it, how many,
// and for members how many are asking to join. Tapping them opens People
// below the grid (decisions.md, 2026-10-18).
const Faces: React.FC<{
  members: ApiAccountJSON[];
  count: number;
  asking: number;
  open: boolean;
  onToggle: () => void;
}> = ({ members, count, asking, open, onToggle }) => {
  const intl = useIntl();
  const shown = members.slice(0, FACES_SHOWN);
  const more = count - shown.length;
  return (
    <button
      type='button'
      className={`krew-detail__faces${open ? ' krew-detail__faces--open' : ''}`}
      onClick={onToggle}
      aria-pressed={open}
    >
      <span className='krew-detail__faces-stack' aria-hidden='true'>
        {shown.map((account) => (
          <span key={account.id} className='krew-detail__member'>
            <Avatar account={createAccountFromServerJSON(account)} size={32} />
          </span>
        ))}
        {more > 0 && <span className='krew-detail__faces-more'>+{more}</span>}
      </span>
      <span className='krew-detail__faces-count'>
        {intl.formatMessage(messages.facesCount, { count })}
      </span>
      {asking > 0 && (
        <span className='krew-detail__faces-asking'>
          {intl.formatMessage(messages.facesAsking, { count: asking })}
        </span>
      )}
    </button>
  );
};

// Someone waiting to be let into the Krew. Any member can answer.
const JoinRequestRow: React.FC<{
  request: ApiKrewJoinRequestJSON;
  busy: boolean;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
}> = ({ request, busy, onAccept, onDecline }) => {
  const model = createAccountFromServerJSON(request.account);
  const handleAccept = useCallback(() => {
    onAccept(request.id);
  }, [request.id, onAccept]);
  const handleDecline = useCallback(() => {
    onDecline(request.id);
  }, [request.id, onDecline]);
  return (
    <li className='krew-detail__request'>
      <Link
        to={`/@${request.account.acct}`}
        className='krew-detail__request-who'
      >
        <Avatar account={model} size={36} />
        <span className='krew-detail__request-name'>
          {model.display_name || request.account.username}
        </span>
        <span className='krew-detail__request-acct'>
          @{request.account.acct}
        </span>
      </Link>
      <div className='krew-detail__request-actions'>
        <button
          type='button'
          className='krew-detail__btn krew-detail__btn--primary'
          onClick={handleAccept}
          disabled={busy}
        >
          <FormattedMessage {...messages.accept} />
        </button>
        <button
          type='button'
          className='krew-detail__btn krew-detail__btn--ghost'
          onClick={handleDecline}
          disabled={busy}
        >
          <FormattedMessage {...messages.decline} />
        </button>
      </div>
    </li>
  );
};

// A tile that opens its space below the grid. The open one is marked.
const OpenTile: React.FC<{
  space: PanelSpace;
  open: boolean;
  onOpen: (space: PanelSpace) => void;
  glyph: React.ReactNode;
  label: string;
}> = ({ space, open, onOpen, glyph, label }) => {
  const handle = useCallback(() => {
    onOpen(space);
  }, [space, onOpen]);
  return (
    <button
      type='button'
      className={`space-tile${open ? ' space-tile--open' : ''}`}
      onClick={handle}
      aria-pressed={open}
    >
      {glyph}
      <span className='space-tile__name'>{label}</span>
    </button>
  );
};

// A tile for something with its own section further down the page (the
// projekts, the chat, a Kuddle): tapping it scrolls there.
const JumpTile: React.FC<{
  slug: string;
  target: string;
  label: string;
}> = ({ slug, target, label }) => {
  const handle = useCallback(() => {
    document
      .getElementById(target)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [target]);
  return (
    <li>
      <button type='button' className='space-tile' onClick={handle}>
        <KrewSpaceIcon slug={slug} className='space-tile__glyph' />
        <span className='space-tile__name'>{label}</span>
      </button>
    </li>
  );
};

// Where each section is, for its tile.
const SECTION_IDS = {
  projekts: 'krew-projekts',
  kuestions: 'krew-kuestions',
  chat: 'krew-chat',
  kuddles: 'krew-kuddles',
} as const;

// The spaces whose things open in place below the tiles. The works are a
// Krew's Gallery, Films, Music and Stories (decisions.md, 2026-11-08).
const PANEL_SPACES: readonly PanelSpace[] = [
  'albutts',
  'kalendar',
  'art',
  'cinema',
  'booth',
  'kronikles',
];
const WORK_SPACES: readonly PanelSpace[] = [
  'art',
  'cinema',
  'booth',
  'kronikles',
];

// Spaces Konnect turns on when picked rather than linking one record (the
// grid says `space`; Albutts and Kalendar turn on by linking instead).
const TURN_ON_SPACES = [
  'kuestions',
  'art',
  'cinema',
  'booth',
  'kronikles',
] as const;

// What a Krew calls its works space.
const spaceNames = defineMessages({
  art: { id: 'krew.space.gallery', defaultMessage: 'Gallery' },
  cinema: { id: 'krew.space.films', defaultMessage: 'Films' },
  booth: { id: 'krew.space.music', defaultMessage: 'Music' },
  kronikles: { id: 'krew.space.stories', defaultMessage: 'Stories' },
});
const spaceName = (slug: PanelSpace) =>
  slug === 'art' ||
  slug === 'cinema' ||
  slug === 'booth' ||
  slug === 'kronikles'
    ? spaceNames[slug]
    : null;

const SpaceTile: React.FC<{
  slug: PanelSpace;
  open: boolean;
  onOpen: (space: PanelSpace) => void;
}> = ({ slug, open, onOpen }) => {
  const intl = useIntl();
  const korner = useKorner(slug);
  const own = spaceName(slug);
  return (
    <OpenTile
      space={slug}
      open={open}
      onOpen={onOpen}
      glyph={<KrewSpaceIcon slug={slug} className='space-tile__glyph' />}
      label={own ? intl.formatMessage(own) : (korner?.name ?? slug)}
    />
  );
};

export const KrewDetail = () => {
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const history = useHistory();
  const location = useLocation();
  // An invite link carries the Krew's token as `?k=`; sent with Join, it is
  // what lets someone into an invite-only Krew.
  const inviteToken = new URLSearchParams(location.search).get('k');
  const dispatch = useAppDispatch();
  const [krew, setKrew] = useState<ApiKrewJSON | null>(null);
  const [members, setMembers] = useState<ApiAccountJSON[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<ApiKrewJoinRequestJSON[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitees, setInvitees] = useState<AccountLite[]>([]);
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  const [activity, setActivity] = useState<ApiKrewActivityJSON | null>(null);
  // Which space is open below the grid. Nothing is, on arrival.
  const [openSpace, setOpenSpace] = useState<OpenSpace>(null);
  useEffect(() => {
    setOpenSpace(null);
  }, [id]);

  const refetch = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [k, m] = await Promise.all([apiGetKrew(id), apiGetKrewMembers(id)]);
      setKrew(k);
      setMembers(m);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Members see who is waiting to be let in. Refetched whenever the count
  // on the Krew changes (a request arrived, or one was answered).
  const isMember = Boolean(krew?.viewer_role);
  const requestCount = krew?.join_request_count ?? 0;

  // The Krew's chat is a space it Konnects (decisions.md, 2026-10-31): a
  // Krew without one has no chat on the page.
  const chatOn = Boolean(krew?.korners.includes('nudges'));
  // Kuestions is a space the Krew turns on (decisions.md, 2026-11-08).
  const kuestionsOn = Boolean(krew?.korners.includes('kuestions'));

  // The chat, for members of a Krew that has one. `cancelled` drops a late
  // answer for a Krew you've already left, so moving quickly between Krews
  // can't show the previous one's. Non-fatal: the page works without it.
  useEffect(() => {
    setActivity(null);
    if (!id || !isMember || !chatOn) return undefined;
    let cancelled = false;
    apiGetKrewActivity(id)
      .then((next) => {
        if (!cancelled) setActivity(next);
      })
      .catch(() => {
        // Nothing to show; the rest of the page stands.
      });
    return () => {
      cancelled = true;
    };
  }, [id, isMember, chatOn]);
  const handleChatRead = useCallback(() => {
    setActivity((prev) =>
      prev ? { ...prev, chat: { ...prev.chat, unread: 0 } } : prev,
    );
  }, []);
  useEffect(() => {
    if (!id || !isMember || requestCount === 0) {
      setRequests([]);
      return undefined;
    }
    let cancelled = false;
    apiGetKrewJoinRequests(id)
      .then((list) => {
        if (!cancelled) setRequests(list);
      })
      .catch(() => {
        if (!cancelled) setRequests([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isMember, requestCount]);

  // Runs a call that answers with the Krew, and shows the answer.
  const runKrewAction = useCallback(
    (action: () => Promise<ApiKrewJSON>, after?: () => void) => {
      setBusy(true);
      setError(null);
      action()
        .then((updated) => {
          setKrew(updated);
          after?.();
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [],
  );

  // Join, or for an `approval` Krew ask to join. A new member also needs
  // the faces refreshed.
  const handleJoin = useCallback(() => {
    if (!id) return;
    runKrewAction(
      () => apiJoinKrew(id, inviteToken),
      () => void refetch(),
    );
  }, [id, inviteToken, refetch, runKrewAction]);

  const handleWithdraw = useCallback(() => {
    if (!id) return;
    runKrewAction(() => apiWithdrawKrewJoinRequest(id));
  }, [id, runKrewAction]);

  const handleAcceptRequest = useCallback(
    (requestId: string) => {
      if (!id) return;
      runKrewAction(
        () => apiAcceptKrewJoinRequest(id, requestId),
        () => void refetch(),
      );
    },
    [id, refetch, runKrewAction],
  );

  const handleDeclineRequest = useCallback(
    (requestId: string) => {
      if (!id) return;
      runKrewAction(() => apiDeclineKrewJoinRequest(id, requestId));
    },
    [id, runKrewAction],
  );

  const toggleInvite = useCallback(() => {
    setInviteOpen((v) => !v);
    setInviteNote(null);
  }, []);

  const handleSendInvites = useCallback(() => {
    if (!id || invitees.length === 0) return;
    setBusy(true);
    setError(null);
    apiInviteToKrew(
      id,
      invitees.map((a) => a.id),
    )
      .then((res) => {
        const count = res.invited_account_ids.length;
        setInviteNote(
          count > 0
            ? intl.formatMessage(messages.invitesSent, { count })
            : intl.formatMessage(messages.invitesNone),
        );
        setInvitees([]);
        setInviteOpen(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setBusy(false);
      });
  }, [id, invitees, intl]);

  const handleImageChange = useCallback(
    (file: File | null) => {
      if (!file || !id) return;
      setBusy(true);
      apiSetKrewImage(id, file)
        .then(refetch)
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [id, refetch],
  );

  // The way in for someone not in the Krew. A valid invite link joins any
  // Krew directly; the server checks the token, so holding one is enough to
  // offer Join.
  const hasInviteLink = Boolean(inviteToken);
  const asksToJoin = krew?.access === 'approval' && !hasInviteLink;
  const needsInvite = krew?.access === 'invite_only' && !hasInviteLink;
  const canJoinNow = Boolean(krew) && !asksToJoin && !needsInvite;
  const shownSpaces = krew
    ? PANEL_SPACES.filter((slug) => krew.korners.includes(slug))
    : [];
  // A space that was removed while open closes.
  const openNow: OpenSpace =
    openSpace === 'people' || (openSpace && shownSpaces.includes(openSpace))
      ? openSpace
      : null;
  const togglePeople = useCallback(() => {
    setOpenSpace((now) => (now === 'people' ? null : 'people'));
  }, []);
  const toggleSpace = useCallback((space: PanelSpace) => {
    setOpenSpace((now) => (now === space ? null : space));
  }, []);

  // A space that is a Krew's own rather than a record (Kuestions; manifest
  // grid `space`, TURN_ON_SPACES) is turned on when it is picked in Konnect.
  const spaceKrewId = krew?.id;
  const turnOnSpace = useCallback(
    async (slug: string) => {
      if (!spaceKrewId || !isKrewKornerSlug(slug)) return;
      setKrew(await apiAttachKorner(spaceKrewId, slug));
    },
    [spaceKrewId],
  );

  // Konnect opens the picker straight away (Tal 2026-10-22: no extra step).
  // It is also how a space gets onto the page: Konnecting or making an album
  // or an event turns that space on (decisions.md, 2026-10-25).
  const renderKonnect = useCallback(
    (openPicker: () => void) => (
      <li>
        <button
          type='button'
          className='space-tile space-tile--action'
          onClick={openPicker}
        >
          <span className='space-tile__glyph' aria-hidden='true'>
            <Icon id='add' icon={AddIcon} />
          </span>
          <span className='space-tile__name'>
            <FormattedMessage {...messages.konnect} />
          </span>
        </button>
      </li>
    ),
    [],
  );

  // A member sees the Krew's albums and events in the Albutts and Kalendar
  // tiles, so the Konnected tiles beside them leave those two spaces out
  // and each album or event shows once (decisions.md, 2026-10-22).
  // Its projekts have their own section below, so they aren't tiles too.
  // A Kuddle Konnected here is a call frame in its own section, as in a
  // projekt (Tal, 2026-10-30: "konnecting a huddle should put a frame into
  // the space"), so it isn't a tile as well.
  const konnectedSkip = [
    ...(isMember ? shownSpaces : []),
    'freethedream',
    'huddle',
  ];
  const [kuddles, setKuddles] = useState<{ room: string; link: string }[]>([]);
  const [projektCount, setProjektCount] = useState(0);
  useEffect(() => {
    setKuddles([]);
    setProjektCount(0);
  }, [id]);
  const handleKonnections = useCallback((rows: ApiAttachmentJSON[]) => {
    const seen = new Set<string>();
    setKuddles(
      rows.flatMap((row) => {
        const room =
          row.target_slug === 'huddle'
            ? row.target_id
            : row.source_slug === 'huddle'
              ? row.source_id
              : null;
        if (!room || seen.has(room)) return [];
        seen.add(room);
        return [{ room, link: row.id }];
      }),
    );
  }, []);
  const handleDiskonnect = useCallback((link: string) => {
    void apiDeleteAttachment(link).then(() => {
      setKuddles((current) => current.filter((k) => k.link !== link));
    });
  }, []);

  const frameKuestions = useCallback(
    (row: React.ReactNode) => (
      <section
        id={SECTION_IDS.kuestions}
        className='krew-detail__section krew-detail__kuestions'
      >
        <h3 className='korner-section-heading'>
          {intl.formatMessage(messages.kuestions)}
        </h3>
        {row}
      </section>
    ),
    [intl],
  );

  // Tiles for what has its own section further down: tapping one scrolls
  // there.
  const jumpTiles = [
    ...(projektCount > 0
      ? [
          <JumpTile
            key='projekts'
            slug='freethedream'
            target={SECTION_IDS.projekts}
            label={intl.formatMessage(messages.projektsTile)}
          />,
        ]
      : []),
    ...(isMember && kuestionsOn
      ? [
          <JumpTile
            key='kuestions'
            slug='kuestions'
            target={SECTION_IDS.kuestions}
            label={intl.formatMessage(messages.kuestions)}
          />,
        ]
      : []),
    ...(chatOn
      ? [
          <JumpTile
            key='chat'
            slug='nudges'
            target={SECTION_IDS.chat}
            label={intl.formatMessage(messages.chatTile)}
          />,
        ]
      : []),
    ...(kuddles.length > 0
      ? [
          <JumpTile
            key='kuddles'
            slug='huddle'
            target={SECTION_IDS.kuddles}
            label={intl.formatMessage(messages.kuddles, {
              count: kuddles.length,
            })}
          />,
        ]
      : []),
  ];

  // The + moon makes something for the Krew in whichever space is open, with
  // the normal composer: a post, an album, an event.
  const krewId = krew?.id;
  const krewName = krew?.name ?? '';
  const plus = useMemo(() => {
    if (!krewId || openNow === 'people') return null;
    if (openNow === 'albutts')
      return {
        label: intl.formatMessage(messages.newAlbum),
        go: () => {
          history.push({
            pathname: '/hub/albutts/composer',
            search: `?krew=${krewId}`,
          });
        },
      };
    if (openNow === 'kalendar')
      return {
        label: intl.formatMessage(messages.newEvent),
        go: () => {
          history.push({
            pathname: '/hub/kalendar/composer',
            search: `?krew=${krewId}`,
          });
        },
      };
    return {
      label: intl.formatMessage(messages.postTo, { krew: krewName }),
      go: () => {
        dispatch(changeComposeKrewTargets([krewId]));
        history.push('/publish');
      },
    };
  }, [krewId, krewName, openNow, intl, history, dispatch]);
  useRegisterPageAction(
    plus
      ? { key: 'post', label: plus.label, icon: AddIcon, iconId: 'add' }
      : null,
    plus?.go ?? null,
    isMember && !krew?.archived && plus !== null,
  );

  // Any member edits the Krew (decisions.md, 2026-10-17), in its settings.
  const krewSlug = krew?.slug;
  const goEdit = useCallback(() => {
    if (krewSlug) history.push(`/hub/krew/${krewSlug}/settings`);
  }, [krewSlug, history]);
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.editKrew),
      icon: EditIcon,
      iconId: 'edit',
    },
    goEdit,
    isMember && Boolean(krewSlug) && !krew?.archived,
  );

  return (
    <Stage label={krew?.name ?? intl.formatMessage(messages.title)}>
      <div className='scrollable krew-detail'>
        {error && <p className='krew-detail__error'>{error}</p>}

        {!krew && !error && (
          <p className='krew-detail__loading'>
            <FormattedMessage {...messages.loading} />
          </p>
        )}

        {krew && (
          <>
            <header className='krew-detail__header'>
              {krew.viewer_role && !krew.archived ? (
                <KrewPhotoField
                  name={krew.name}
                  imageUrl={krew.image_url}
                  label={intl.formatMessage(messages.changeImage)}
                  icon={PhotoCameraIcon}
                  disabled={busy}
                  onPick={handleImageChange}
                />
              ) : (
                <span
                  className='krew-detail__avatar'
                  aria-hidden='true'
                  data-initial={initial(krew.name)}
                >
                  {krew.image_url ? (
                    <img
                      src={krew.image_url}
                      alt=''
                      className='krew-detail__avatar-img'
                    />
                  ) : (
                    initial(krew.name)
                  )}
                </span>
              )}
              <div className='krew-detail__identity'>
                <h1 className='krew-detail__name'>
                  {krew.name}
                  <KrewAccessMark
                    access={krew.access}
                    className='krew-detail__marker'
                  />
                </h1>
                <div className='krew-detail__submeta'>
                  <span className='krew-detail__slug'>@{krew.slug}</span>
                  {krew.archived && (
                    <span className='krew-detail__archived-badge'>
                      <FormattedMessage {...messages.archived} />
                    </span>
                  )}
                </div>
              </div>
            </header>

            {krew.description && (
              <p className='krew-detail__description'>{krew.description}</p>
            )}

            <Faces
              members={members}
              count={krew.member_count}
              asking={isMember ? requestCount : 0}
              open={openNow === 'people'}
              onToggle={togglePeople}
            />

            {/* Members reach Settings (which carries Leave) via the floating
                Ж bubble. Someone not in the Krew gets the one way in that
                its access allows, up here where it can be seen. */}
            {!krew.archived && !krew.viewer_role && (
              <div className='krew-detail__actions'>
                {krew.viewer_requested && !canJoinNow && (
                  <>
                    <p className='krew-detail__section-hint'>
                      <FormattedMessage {...messages.asked} />
                    </p>
                    <button
                      type='button'
                      onClick={handleWithdraw}
                      disabled={busy}
                      className='krew-detail__btn krew-detail__btn--ghost'
                    >
                      <FormattedMessage {...messages.withdraw} />
                    </button>
                  </>
                )}
                {!krew.viewer_requested && asksToJoin && (
                  <>
                    <button
                      type='button'
                      onClick={handleJoin}
                      disabled={busy}
                      className='krew-detail__btn krew-detail__btn--primary'
                    >
                      <FormattedMessage {...messages.askToJoin} />
                    </button>
                    <p className='krew-detail__section-hint'>
                      <FormattedMessage {...messages.askHint} />
                    </p>
                  </>
                )}
                {krew.access === 'requirement_gated' &&
                  !hasInviteLink &&
                  krew.requirements.length > 0 && (
                    <div className='krew-detail__needs'>
                      <p className='krew-detail__section-hint'>
                        <FormattedMessage {...messages.needsHeading} />
                      </p>
                      <ul className='krew-detail__needs-list'>
                        {krew.requirements.map((req) => (
                          <li key={req.id}>{requirementSummary(req, intl)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                {canJoinNow && (
                  <button
                    type='button'
                    onClick={handleJoin}
                    disabled={busy}
                    className='krew-detail__btn krew-detail__btn--primary'
                  >
                    <FormattedMessage {...messages.join} />
                  </button>
                )}
                {needsInvite && (
                  <p className='krew-detail__section-hint'>
                    <FormattedMessage {...messages.inviteOnlyHint} />
                  </p>
                )}
              </div>
            )}

            {openNow === 'people' && (
              <section className='krew-detail__section krew-detail__people'>
                {isMember && requests.length > 0 && (
                  <>
                    <h3 className='korner-section-heading'>
                      <FormattedMessage {...messages.requests} />
                      <span className='krew-detail__count'>
                        {requests.length}
                      </span>
                    </h3>
                    <ul className='krew-detail__requests'>
                      {requests.map((request) => (
                        <JoinRequestRow
                          key={request.id}
                          request={request}
                          busy={busy}
                          onAccept={handleAcceptRequest}
                          onDecline={handleDeclineRequest}
                        />
                      ))}
                    </ul>
                  </>
                )}

                <h3 className='korner-section-heading'>
                  <FormattedMessage {...messages.inThisKrew} />
                  <span className='krew-detail__count'>
                    {krew.member_count}
                  </span>
                </h3>
                {isMember && !krew.archived && (
                  <div className='krew-detail__invite'>
                    {!inviteOpen && (
                      <button
                        type='button'
                        onClick={toggleInvite}
                        className='krew-detail__btn krew-detail__btn--secondary'
                      >
                        <FormattedMessage {...messages.invitePeople} />
                      </button>
                    )}
                    {inviteNote && (
                      <p className='krew-detail__section-hint' role='status'>
                        {inviteNote}
                      </p>
                    )}
                    {inviteOpen && (
                      <div className='krew-detail__invite-panel'>
                        <p className='krew-detail__section-hint'>
                          <FormattedMessage {...messages.inviteHint} />
                        </p>
                        <AccountMultiSelect
                          value={invitees}
                          onChange={setInvitees}
                          disabled={busy}
                        />
                        <div className='krew-detail__actions'>
                          <button
                            type='button'
                            onClick={handleSendInvites}
                            disabled={busy || invitees.length === 0}
                            className='krew-detail__btn krew-detail__btn--primary'
                          >
                            <FormattedMessage {...messages.sendInvites} />
                          </button>
                          <button
                            type='button'
                            onClick={toggleInvite}
                            disabled={busy}
                            className='krew-detail__btn krew-detail__btn--ghost'
                          >
                            <FormattedMessage {...messages.cancel} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <ul className='krew-detail__requests'>
                  {members.map((account) => (
                    <PersonRow key={account.id} account={account} />
                  ))}
                </ul>
              </section>
            )}

            {/* The Krew's spaces first: a tile for each thing it has, each
                opening in place or scrolling to its section, then what it's
                Konnected to elsewhere, then Konnect. */}
            <AttachmentSection
              korner='krew'
              recordId={krew.id}
              canManage={isMember && !krew.archived}
              heading={
                isMember ? <FormattedMessage {...messages.spaces} /> : undefined
              }
              excludeSlugs={konnectedSkip}
              leading={
                isMember
                  ? [
                      ...shownSpaces.map((slug) => (
                        <li key={slug}>
                          <SpaceTile
                            slug={slug}
                            open={openNow === slug}
                            onOpen={toggleSpace}
                          />
                        </li>
                      )),
                      ...jumpTiles,
                    ]
                  : undefined
              }
              renderKonnect={renderKonnect}
              onKonnections={handleKonnections}
              onTurnOnSpace={turnOnSpace}
              turnOnSlugs={TURN_ON_SPACES}
            />

            {isMember && openNow === 'kalendar' && (
              <KrewEvents krewId={krew.id} />
            )}

            {isMember && openNow === 'albutts' && (
              <KrewAlbums krewId={krew.id} canAdd={!krew.archived} />
            )}

            {isMember &&
              openNow &&
              WORK_SPACES.includes(openNow as PanelSpace) && (
                <SpaceShelf
                  homeSlug='krew'
                  homeId={krew.id}
                  korner={openNow}
                  title={intl.formatMessage(
                    spaceNames[
                      openNow as 'art' | 'cinema' | 'booth' | 'kronikles'
                    ],
                  )}
                  canAdd={!krew.archived}
                />
              )}

            {/* What the Krew is making. */}
            <KrewProjekts
              id={SECTION_IDS.projekts}
              krewId={krew.id}
              canStart={isMember && !krew.archived}
              onCount={setProjektCount}
            />

            {/* Its own Kuestions, for its members only, once it has turned
                Kuestions on. */}
            {isMember && kuestionsOn && (
              <HomeKuestions
                home={{ kind: 'krew', id: krew.id }}
                canAsk={!krew.archived}
                frame={frameKuestions}
              />
            )}

            {isMember && chatOn && activity && (
              <KrewChat
                conversationId={activity.chat.conversation_id}
                onRead={handleChatRead}
              />
            )}

            {isMember && kuddles.length > 0 && (
              <section
                id={SECTION_IDS.kuddles}
                className='krew-detail__section krew-detail__kuddles'
              >
                <h3 className='korner-section-heading'>
                  {intl.formatMessage(messages.kuddles, {
                    count: kuddles.length,
                  })}
                </h3>
                {kuddles.map((k) => (
                  <KuddleFrame
                    key={k.room}
                    roomId={k.room}
                    link={k.link}
                    showKind={false}
                    onDiskonnect={krew.archived ? undefined : handleDiskonnect}
                  />
                ))}
              </section>
            )}

            {/* The Krew's posts, last, so the page scrolls on into them. */}
            {isMember && <KrewPosts krewId={krew.id} />}
          </>
        )}
      </div>
    </Stage>
  );
};
