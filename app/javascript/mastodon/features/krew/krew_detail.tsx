import { useEffect, useMemo, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useParams, useHistory, useLocation } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import ChatIcon from '@/material-icons/400-24px/chat.svg?react';
import PhotoCameraIcon from '@/material-icons/400-24px/photo_camera.svg?react';
import { changeComposeKrewTargets } from 'mastodon/actions/compose';
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
  KREW_PAGE_SPACES,
} from 'mastodon/api/krew';
import type {
  ApiKrewActivityJSON,
  ApiKrewActivityLineJSON,
  ApiKrewJSON,
  ApiKrewJoinRequestJSON,
  KrewKornerSlug,
} from 'mastodon/api/krew';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { AccountMultiSelect } from 'mastodon/components/account_multi_select';
import type { AccountLite } from 'mastodon/components/account_multi_select';
import { Avatar } from 'mastodon/components/avatar';
import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { Stage } from 'mastodon/components/stage';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useKorner } from 'mastodon/hooks/useKorner';
import { createAccountFromServerJSON } from 'mastodon/models/account';
import { useAppDispatch } from 'mastodon/store';

import { KrewAlbums } from './krew_albums';
import { KrewChat } from './krew_chat';
import { KrewEvents } from './krew_events';
import { KrewPhotoField } from './krew_photo_field';
import { KrewSpaceIcon } from './krew_space_icon';

// Krew page (/hub/krew/:id) — identity, who's in it, and a Hub-style
// grid to the Krew's spaces plus Add-a-space + Chat. Redesigned
// 2026-08-31 (Tal): dropped the in-page "All krews" back chip (the
// system back covers it) and the stats / invite / archive blocks —
// Settings lives on the floating space menu; the group Chat (a Nudges KREW
// conversation) opens from the grid.

// What's happening sits above the grid: the last few things done in the
// Krew. The grid's tiles open their space below it, one at a time, and
// close again on a second tap (decisions.md, 2026-10-18): its albums, its
// events. Only spaces with a Krew part get a tile (KREW_PAGE_SPACES); a
// Krew that turned on another space keeps it, but it has nothing to show
// here yet. People opens from the faces under the Krew's name.
type OpenSpace = 'albutts' | 'kalendar' | 'people' | null;

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
  spacesEmpty: {
    id: 'krew.detail.spaces_empty',
    defaultMessage:
      'No spaces yet — add one to give this Krew somewhere to gather.',
  },
  addSpace: { id: 'krew.detail.add_space', defaultMessage: 'Add a space' },
  changeImage: {
    id: 'krew.detail.change_image',
    defaultMessage: 'Change photo',
  },
  newEvent: {
    id: 'krew.events.new',
    defaultMessage: 'New event for this Krew',
  },
  inviteOnly: { id: 'krew.marker.invite_only', defaultMessage: 'Invite-only' },
  archived: { id: 'krew.detail.archived', defaultMessage: 'archived' },
  happening: { id: 'krew.detail.feed', defaultMessage: "What's happening" },
  postTo: { id: 'krew.detail.post_to', defaultMessage: 'Post to {krew}' },
  newAlbum: { id: 'krew.detail.new_album', defaultMessage: 'New Krew album' },
  happeningEmpty: {
    id: 'krew.detail.happening_empty',
    defaultMessage: 'Nothing yet. What the Krew does will show up here.',
  },
  happeningChat: {
    id: 'krew.detail.happening_chat',
    defaultMessage:
      '{count, plural, one {# unread message} other {# unread messages}} in the chat',
  },
  happeningPhotos: {
    id: 'krew.detail.happening_photos',
    defaultMessage:
      '{name} added {count, plural, one {a photo} other {# photos}} to {album}',
  },
  happeningEvent: {
    id: 'krew.detail.happening_event',
    defaultMessage: '{name} added an event: {title}',
  },
  happeningPost: {
    id: 'krew.detail.happening_post',
    defaultMessage: '{name} posted to the Krew',
  },
  happeningJoined: {
    id: 'krew.detail.happening_joined',
    defaultMessage: '{name} joined the Krew',
  },
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

// One thing done in the Krew, linking to it.
const HappeningRow: React.FC<{ line: ApiKrewActivityLineJSON }> = ({
  line,
}) => {
  const model = createAccountFromServerJSON(line.account);
  const name = <strong>{model.display_name || line.account.username}</strong>;
  let to = `/@${line.account.acct}`;
  let text: React.ReactNode;
  if (line.kind === 'photos' && line.album) {
    to = `/hub/albutts/albums/${line.album.id}`;
    text = (
      <FormattedMessage
        {...messages.happeningPhotos}
        values={{
          name,
          count: line.count ?? 1,
          album: <strong>{line.album.title}</strong>,
        }}
      />
    );
  } else if (line.kind === 'event' && line.event) {
    to = `/hub/kalendar/${line.event.slug ?? line.event.id}`;
    text = (
      <FormattedMessage
        {...messages.happeningEvent}
        values={{ name, title: <strong>{line.event.title}</strong> }}
      />
    );
  } else if (line.kind === 'post' && line.status_id) {
    to = `/@${line.account.acct}/${line.status_id}`;
    text = <FormattedMessage {...messages.happeningPost} values={{ name }} />;
  } else {
    text = <FormattedMessage {...messages.happeningJoined} values={{ name }} />;
  }
  return (
    <li>
      <Link to={to} className='krew-detail__happening-line'>
        <Avatar account={model} size={28} />
        <span className='krew-detail__happening-text'>{text}</span>
        <span className='krew-detail__happening-when'>
          <RelativeTimestamp timestamp={line.at} />
        </span>
      </Link>
    </li>
  );
};

// What's happening: unread chat first, then the last few things done.
const scrollToChat = () => {
  document
    .getElementById('krew-chat')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const Happening: React.FC<{ activity: ApiKrewActivityJSON | null }> = ({
  activity,
}) => {
  if (!activity) return null;
  const { chat, lines } = activity;
  return (
    <section className='krew-detail__section krew-detail__happening'>
      <h3 className='krew-detail__section-heading'>
        <FormattedMessage {...messages.happening} />
      </h3>
      {chat.unread === 0 && lines.length === 0 ? (
        <p className='krew-detail__section-hint'>
          <FormattedMessage {...messages.happeningEmpty} />
        </p>
      ) : (
        <ul className='krew-detail__happening-list'>
          {chat.unread > 0 && (
            <li>
              <button
                type='button'
                onClick={scrollToChat}
                className='krew-detail__happening-line krew-detail__happening-line--chat'
              >
                <span
                  className='krew-detail__happening-glyph'
                  aria-hidden='true'
                >
                  <Icon id='chat' icon={ChatIcon} />
                </span>
                <span className='krew-detail__happening-text'>
                  <FormattedMessage
                    {...messages.happeningChat}
                    values={{ count: chat.unread }}
                  />
                </span>
              </button>
            </li>
          )}
          {lines.map((line) => (
            <HappeningRow
              key={`${line.kind}-${line.at}-${line.account.id}`}
              line={line}
            />
          ))}
        </ul>
      )}
    </section>
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
  space: 'albutts' | 'kalendar';
  open: boolean;
  onOpen: (space: 'albutts' | 'kalendar') => void;
  glyph: React.ReactNode;
  label: string;
}> = ({ space, open, onOpen, glyph, label }) => {
  const handle = useCallback(() => {
    onOpen(space);
  }, [space, onOpen]);
  return (
    <button
      type='button'
      className={`krew-detail__space-tile${open ? ' krew-detail__space-tile--open' : ''}`}
      onClick={handle}
      aria-pressed={open}
    >
      {glyph}
      <span className='krew-detail__space-name'>{label}</span>
    </button>
  );
};

const SpaceTile: React.FC<{
  slug: 'albutts' | 'kalendar';
  open: boolean;
  onOpen: (space: 'albutts' | 'kalendar') => void;
}> = ({ slug, open, onOpen }) => {
  const korner = useKorner(slug);
  return (
    <OpenTile
      space={slug}
      open={open}
      onOpen={onOpen}
      glyph={<KrewSpaceIcon slug={slug} className='krew-detail__space-glyph' />}
      label={korner?.name ?? slug}
    />
  );
};

// A tile in the "add a space" tray — attaches the Korner on click.
const AddableTile: React.FC<{
  slug: KrewKornerSlug;
  onAttach: (slug: KrewKornerSlug) => void;
}> = ({ slug, onAttach }) => {
  const korner = useKorner(slug);
  const handle = useCallback(() => {
    onAttach(slug);
  }, [slug, onAttach]);
  return (
    <button
      type='button'
      className='krew-detail__space-tile krew-detail__space-tile--addable'
      onClick={handle}
    >
      <KrewSpaceIcon slug={slug} className='krew-detail__space-glyph' />
      <span className='krew-detail__space-name'>{korner?.name ?? slug}</span>
    </button>
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
  const [addOpen, setAddOpen] = useState(false);
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

  // What's happening, for members. `cancelled` drops a late answer for a
  // Krew you've already left, so moving quickly between Krews can't show
  // the previous one's. Non-fatal: the page works without it.
  useEffect(() => {
    setActivity(null);
    if (!id || !isMember) return undefined;
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
  }, [id, isMember]);
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

  const toggleAdd = useCallback(() => {
    setAddOpen((v) => !v);
  }, []);

  const handleAttach = useCallback(
    (slug: KrewKornerSlug) => {
      if (!id) return;
      setBusy(true);
      apiAttachKorner(id, slug)
        .then(refetch)
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          setBusy(false);
          setAddOpen(false);
        });
    },
    [id, refetch],
  );

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

  const canManage = Boolean(krew?.viewer_role);
  // The way in for someone not in the Krew. A valid invite link joins any
  // Krew directly; the server checks the token, so holding one is enough to
  // offer Join.
  const hasInviteLink = Boolean(inviteToken);
  const asksToJoin = krew?.access === 'approval' && !hasInviteLink;
  const needsInvite = krew?.access === 'invite_only' && !hasInviteLink;
  const canJoinNow = Boolean(krew) && !asksToJoin && !needsInvite;
  const attachable = krew
    ? KREW_PAGE_SPACES.filter((slug) => !krew.korners.includes(slug))
    : [];
  const shownSpaces = krew
    ? KREW_PAGE_SPACES.filter((slug) => krew.korners.includes(slug))
    : [];
  // A space that was removed while open closes.
  const openNow: OpenSpace =
    openSpace === 'people' || (openSpace && shownSpaces.includes(openSpace))
      ? openSpace
      : null;
  const togglePeople = useCallback(() => {
    setOpenSpace((now) => (now === 'people' ? null : 'people'));
  }, []);
  const toggleSpace = useCallback((space: 'albutts' | 'kalendar') => {
    setOpenSpace((now) => (now === space ? null : space));
  }, []);

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
                  {krew.access === 'invite_only' && (
                    <span
                      className='krew-detail__marker'
                      aria-label={intl.formatMessage(messages.inviteOnly)}
                      title={intl.formatMessage(messages.inviteOnly)}
                    >
                      ⚿
                    </span>
                  )}
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

            {isMember && <Happening activity={activity} />}

            {isMember && (
              <section className='krew-detail__section'>
                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.spaces} />
                </h3>
                <div className='krew-detail__space-grid'>
                  {shownSpaces.map((slug) => (
                    <SpaceTile
                      key={slug}
                      slug={slug as 'albutts' | 'kalendar'}
                      open={openNow === slug}
                      onOpen={toggleSpace}
                    />
                  ))}

                  {canManage && !krew.archived && attachable.length > 0 && (
                    <button
                      type='button'
                      className='krew-detail__space-tile krew-detail__space-tile--action'
                      onClick={toggleAdd}
                      aria-expanded={addOpen}
                    >
                      <span
                        className='krew-detail__space-glyph'
                        aria-hidden='true'
                      >
                        <Icon id='add' icon={AddIcon} />
                      </span>
                      <span className='krew-detail__space-name'>
                        <FormattedMessage {...messages.addSpace} />
                      </span>
                    </button>
                  )}
                </div>

                {addOpen && canManage && attachable.length > 0 && (
                  <div className='krew-detail__space-grid krew-detail__space-grid--tray'>
                    {attachable.map((slug) => (
                      <AddableTile
                        key={slug}
                        slug={slug}
                        onAttach={handleAttach}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {openNow === 'people' && (
              <section className='krew-detail__section krew-detail__people'>
                {canManage && requests.length > 0 && (
                  <>
                    <h3 className='krew-detail__section-heading'>
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

                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.inThisKrew} />
                  <span className='krew-detail__count'>
                    {krew.member_count}
                  </span>
                </h3>
                {canManage && !krew.archived && (
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

            {isMember && openNow === 'kalendar' && (
              <KrewEvents krewId={krew.id} canLink={!krew.archived} />
            )}

            {isMember && openNow === 'albutts' && (
              <KrewAlbums krewId={krew.id} canLink={!krew.archived} />
            )}

            {isMember && activity && (
              <KrewChat
                conversationId={activity.chat.conversation_id}
                onRead={handleChatRead}
              />
            )}
          </>
        )}
      </div>
    </Stage>
  );
};
