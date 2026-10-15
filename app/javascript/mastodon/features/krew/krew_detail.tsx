import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useParams, useHistory, useLocation } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import ChatIcon from '@/material-icons/400-24px/chat.svg?react';
import PhotoCameraIcon from '@/material-icons/400-24px/photo_camera.svg?react';
import { importFetchedStatuses } from 'mastodon/actions/importer';
import {
  apiGetKrew,
  apiGetKrewMembers,
  apiGetKrewChat,
  apiSetKrewImage,
  apiJoinKrew,
  apiWithdrawKrewJoinRequest,
  apiGetKrewJoinRequests,
  apiAcceptKrewJoinRequest,
  apiDeclineKrewJoinRequest,
  apiInviteToKrew,
  apiAttachKorner,
  apiGetKrewStatuses,
} from 'mastodon/api/krew';
import type {
  ApiKrewJSON,
  ApiKrewJoinRequestJSON,
  KrewKornerSlug,
} from 'mastodon/api/krew';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { AccountMultiSelect } from 'mastodon/components/account_multi_select';
import type { AccountLite } from 'mastodon/components/account_multi_select';
import { Avatar } from 'mastodon/components/avatar';
import { Icon } from 'mastodon/components/icon';
import { KornerGlyph } from 'mastodon/components/korner_glyph';
import { Stage } from 'mastodon/components/stage';
import StatusContainerJSX from 'mastodon/containers/status_container';
import { useKorner } from 'mastodon/hooks/useKorner';
import { createAccountFromServerJSON } from 'mastodon/models/account';
import { useAppDispatch } from 'mastodon/store';

import { KrewEvents } from './krew_events';
import { KrewPhotoField } from './krew_photo_field';

// StatusContainer is a legacy JSX/Redux `connect` component with no
// generated types — cast at the boundary so the mini-feed's map stays
// clean rather than sprinkling `@ts-expect-error` per element.
const StatusContainer = StatusContainerJSX as unknown as React.FC<{
  id: string;
  contextType?: string;
}>;

// Krew page (/hub/krew/:id) — identity, who's in it, and a Hub-style
// grid to the Krew's spaces plus Add-a-space + Chat. Redesigned
// 2026-08-31 (Tal): dropped the in-page "All krews" back chip (the
// system back covers it) and the stats / invite / archive blocks —
// Settings lives on the floating space menu; the group Chat (a Nudges KREW
// conversation) opens from the grid.

// Korners a Krew can turn on — mirrors KrewKorner::KORNERS and the
// composer's list.
const KORNER_OPTIONS: KrewKornerSlug[] = [
  'booth',
  'huddle',
  'kalendar',
  'kommons',
  'map',
  'albutts',
  'kuestions',
];

const messages = defineMessages({
  title: { id: 'krew.detail.title', defaultMessage: 'Krew' },
  loading: { id: 'krew.detail.loading', defaultMessage: 'Loading…' },
  inThisKrew: {
    id: 'krew.detail.in_this_krew',
    defaultMessage: 'In this Krew',
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
  chat: { id: 'krew.detail.chat', defaultMessage: 'Chat' },
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
  feed: { id: 'krew.detail.feed', defaultMessage: "What's happening" },
  feedEmpty: {
    id: 'krew.detail.feed_empty',
    defaultMessage:
      'Nothing here yet. Posts targeting this Krew will show up here.',
  },
});

const initial = (name: string): string => {
  const first = name.trim().charAt(0);
  return first.length === 0 ? 'K' : first.toUpperCase();
};

const MemberFace: React.FC<{ account: ApiAccountJSON }> = ({ account }) => {
  const model = createAccountFromServerJSON(account);
  return (
    <Link
      to={`/@${account.acct}`}
      className='krew-detail__member'
      title={model.display_name || account.username}
    >
      <Avatar account={model} size={36} />
    </Link>
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

// A tappable Hub-style space tile for an attached Korner. It opens the
// space, unless the Krew page has somewhere better to send it (`to`).
const SpaceTile: React.FC<{
  slug: KrewKornerSlug;
  to?: { pathname: string; search: string };
  title?: string;
}> = ({ slug, to, title }) => {
  const korner = useKorner(slug);
  return (
    <Link
      to={to ?? `/hub/${slug}`}
      className='krew-detail__space-tile'
      title={title}
    >
      <KornerGlyph
        slug={slug}
        className='krew-detail__space-glyph'
        aria-hidden='true'
      />
      <span className='krew-detail__space-name'>{korner?.name ?? slug}</span>
    </Link>
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
      <KornerGlyph
        slug={slug}
        className='krew-detail__space-glyph'
        aria-hidden='true'
      />
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
  // Mini-feed: the ids of statuses targeting this krew, newest first. The
  // status records themselves live in Redux via `importFetchedStatuses` so
  // <StatusContainer> picks them up like any other feed item.
  const [feedIds, setFeedIds] = useState<string[]>([]);
  const [feedLoaded, setFeedLoaded] = useState(false);

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

  // Fetch the krew's mini-feed once we have the krew loaded. Non-fatal on
  // failure — an errored feed shouldn't block the identity + members + spaces
  // above from rendering. Refetches when the id changes (route → different
  // krew), not on every re-render.
  // `cancelled` drops a late answer for a Krew you've already left, so
  // moving quickly between Krews can't show the previous one's feed.
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    setFeedLoaded(false);
    apiGetKrewStatuses(id, { limit: 20 })
      .then((statuses) => {
        if (cancelled) return;
        dispatch(importFetchedStatuses(statuses));
        setFeedIds(statuses.map((s) => s.id));
        setFeedLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setFeedLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, dispatch]);

  // Members see who is waiting to be let in. Refetched whenever the count
  // on the Krew changes (a request arrived, or one was answered).
  const isMember = Boolean(krew?.viewer_role);
  const requestCount = krew?.join_request_count ?? 0;
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

  const handleChat = useCallback(() => {
    if (!id) return;
    setBusy(true);
    apiGetKrewChat(id)
      .then((res) => {
        history.push(`/nudges/${res.conversation_id}`);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setBusy(false);
      });
  }, [id, history]);

  const canManage = Boolean(krew?.viewer_role);
  // The way in for someone not in the Krew. A valid invite link joins any
  // Krew directly; the server checks the token, so holding one is enough to
  // offer Join.
  const hasInviteLink = Boolean(inviteToken);
  const asksToJoin = krew?.access === 'approval' && !hasInviteLink;
  const needsInvite = krew?.access === 'invite_only' && !hasInviteLink;
  const canJoinNow = Boolean(krew) && !asksToJoin && !needsInvite;
  const attachable = krew
    ? KORNER_OPTIONS.filter((slug) => !krew.korners.includes(slug))
    : [];

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
              {krew.viewer_role === 'seeder' ? (
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

            {canManage && requests.length > 0 && (
              <section className='krew-detail__section'>
                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.requests} />
                  <span className='krew-detail__count'>{requests.length}</span>
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
              </section>
            )}

            <section className='krew-detail__section'>
              <h3 className='krew-detail__section-heading'>
                <FormattedMessage {...messages.inThisKrew} />
                <span className='krew-detail__count'>{krew.member_count}</span>
              </h3>
              <div className='krew-detail__members'>
                {members.map((account) => (
                  <MemberFace key={account.id} account={account} />
                ))}
              </div>

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
            </section>

            <section className='krew-detail__section'>
              <h3 className='krew-detail__section-heading'>
                <FormattedMessage {...messages.spaces} />
              </h3>
              {krew.korners.length === 0 && !canManage && (
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.spacesEmpty} />
                </p>
              )}
              <div className='krew-detail__space-grid'>
                {krew.korners.map((slug) =>
                  // Kalendar on a Krew's page is for making the Krew an
                  // event: the composer opens with this Krew as the audience.
                  slug === 'kalendar' && isMember && !krew.archived ? (
                    <SpaceTile
                      key={slug}
                      slug={slug}
                      to={{
                        pathname: '/hub/kalendar/composer',
                        search: `?krew=${krew.id}`,
                      }}
                      title={intl.formatMessage(messages.newEvent)}
                    />
                  ) : (
                    <SpaceTile key={slug} slug={slug} />
                  ),
                )}

                {canManage && attachable.length > 0 && (
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

                {canManage && (
                  <button
                    type='button'
                    className='krew-detail__space-tile krew-detail__space-tile--action'
                    onClick={handleChat}
                    disabled={busy}
                  >
                    <span
                      className='krew-detail__space-glyph'
                      aria-hidden='true'
                    >
                      <Icon id='chat' icon={ChatIcon} />
                    </span>
                    <span className='krew-detail__space-name'>
                      <FormattedMessage {...messages.chat} />
                    </span>
                  </button>
                )}
              </div>

              {addOpen && attachable.length > 0 && (
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

            {isMember && krew.korners.includes('kalendar') && (
              <KrewEvents krewId={krew.id} />
            )}

            <section className='krew-detail__section krew-detail__feed'>
              <h3 className='krew-detail__section-heading'>
                <FormattedMessage {...messages.feed} />
              </h3>
              {feedLoaded && feedIds.length === 0 && (
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.feedEmpty} />
                </p>
              )}
              {feedIds.length > 0 && (
                <div className='krew-detail__feed-list'>
                  {feedIds.map((statusId) => (
                    <StatusContainer
                      key={statusId}
                      id={statusId}
                      contextType='krew'
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Stage>
  );
};
