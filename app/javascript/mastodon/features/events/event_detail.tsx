import {
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useRef,
} from 'react';

import {
  FormattedDate,
  FormattedTime,
  defineMessages,
  useIntl,
} from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams, Link, useHistory } from 'react-router-dom';

import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import LocationOnIcon from '@/material-icons/400-24px/location_on.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import RepeatIcon from '@/material-icons/400-24px/repeat.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import SpiralIcon from '@/material-icons/400-24px/spiral.svg?react';
import StarIcon from '@/material-icons/400-24px/star.svg?react';
import api from 'mastodon/api';
import { AttachmentSection } from 'mastodon/components/attachment_section';
import { CopyIconButton } from 'mastodon/components/copy_icon_button';
import { Icon } from 'mastodon/components/icon';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { MapPinPreview } from 'mastodon/components/map_pin_preview';
import { ShareSheet } from 'mastodon/components/share_sheet';
import { Stage } from 'mastodon/components/stage';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

import { CreateEventForm } from './components/create_event_form';
import { parseOsmUrl } from './parse_osm_url';

const messages = defineMessages({
  going: { id: 'events.detail.going', defaultMessage: 'Going' },
  interested: { id: 'events.detail.interested', defaultMessage: 'Interested' },
  notGoing: { id: 'events.detail.not_going', defaultMessage: "Can't go" },
  deleteTitle: {
    id: 'events.detail.delete_title',
    defaultMessage: 'Delete this event?',
  },
  deleteMessage: {
    id: 'events.detail.delete_message',
    defaultMessage:
      "It will disappear from everyone's Kalendar and from the feed.",
  },
  delete: { id: 'events.detail.delete', defaultMessage: 'Delete' },
  editEvent: { id: 'events.detail.edit_event', defaultMessage: 'Edit event' },
  stageEvent: { id: 'events.detail.stage_event', defaultMessage: 'Event' },
  stageEdit: { id: 'events.detail.stage_edit', defaultMessage: 'Edit Event' },
  loading: { id: 'events.detail.loading', defaultMessage: 'Loading...' },
  invited: { id: 'events.detail.invited', defaultMessage: 'Invited' },
  invite: { id: 'events.detail.invite', defaultMessage: 'Invite' },
  liveNow: { id: 'events.detail.live_now', defaultMessage: 'LIVE NOW' },
  readMore: { id: 'events.detail.read_more', defaultMessage: 'Read more' },
  copyAddress: {
    id: 'events.detail.copy_address',
    defaultMessage: 'Copy address',
  },
  recurring: {
    id: 'events.detail.recurring',
    defaultMessage: 'Recurring event',
  },
  rsvp: { id: 'events.detail.rsvp', defaultMessage: 'RSVP' },
  share: { id: 'events.detail.share', defaultMessage: 'Share' },
  joinHuddle: {
    id: 'events.detail.join_huddle',
    defaultMessage: 'Join Huddle',
  },
  searchPlaceholder: {
    id: 'events.detail.search_placeholder',
    defaultMessage: 'Search for people to invite...',
  },
  searching: { id: 'events.detail.searching', defaultMessage: 'Searching...' },
  noResults: {
    id: 'events.detail.no_results',
    defaultMessage: 'No results found',
  },
});

interface Attendee {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  url: string;
}

interface SearchAccount {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  acct: string;
}

interface Event {
  id: string;
  slug?: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  location_url: string | null;
  event_type: string;
  huddle_url: string | null;
  rsvp_enabled: boolean;
  spawn_album: boolean;
  max_attendees: number | null;
  recurrence_rule: string | null;
  going_count: number;
  interested_count: number;
  rsvp: string | null;
  invited: boolean;
  cancelled: boolean;
  account: EventAccount;
  status_id: string | null;
  image_url: string | null;
  is_owner: boolean;
  visibility?: string | null;
}

interface EventAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  url: string;
  avatar?: string;
}

type RsvpStatus = 'going' | 'interested' | 'not_going';

const RSVP_CONFIG: Record<
  RsvpStatus,
  { label: MessageDescriptor; icon: typeof CheckIcon; className: string }
> = {
  going: { label: messages.going, icon: CheckIcon, className: 'active--going' },
  interested: {
    label: messages.interested,
    icon: StarIcon,
    className: 'active--interested',
  },
  not_going: {
    label: messages.notGoing,
    icon: CloseIcon,
    className: 'active--not-going',
  },
};

const EventDetail: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [event, setEvent] = useState<Event | null>(null);
  const [goingAttendees, setGoingAttendees] = useState<Attendee[]>([]);
  const [interestedAttendees, setInterestedAttendees] = useState<Attendee[]>(
    [],
  );
  const [notGoingAttendees, setNotGoingAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchAccount[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Description veil — measure whether the text overflows its clamped
  // box after each fetch; if so, show the "Read more" affordance under
  // the fade. `useLayoutEffect` runs before paint so we don't flash
  // the button on for a frame before the measurement resolves.
  const descRef = useRef<HTMLDivElement | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const handleExpandDesc = useCallback(() => {
    setDescExpanded(true);
  }, []);

  // Build a map of account_id -> rsvp status
  const rsvpMap = new Map<string, RsvpStatus>();
  goingAttendees.forEach((a) => rsvpMap.set(a.id, 'going'));
  interestedAttendees.forEach((a) => rsvpMap.set(a.id, 'interested'));
  notGoingAttendees.forEach((a) => rsvpMap.set(a.id, 'not_going'));

  const fetchAll = useCallback(async () => {
    try {
      const [eventRes, goingRes, interestedRes, notGoingRes] =
        await Promise.all([
          api().get(`/api/v1/events/${id}`),
          api().get(`/api/v1/events/${id}/attendees`, {
            params: { status: 'going' },
          }),
          api().get(`/api/v1/events/${id}/attendees`, {
            params: { status: 'interested' },
          }),
          api().get(`/api/v1/events/${id}/attendees`, {
            params: { status: 'not_going' },
          }),
        ]);
      setEvent(eventRes.data as Event);
      setGoingAttendees(goingRes.data as Attendee[]);
      setInterestedAttendees(interestedRes.data as Attendee[]);
      setNotGoingAttendees(notGoingRes.data as Attendee[]);
    } catch (err) {
      console.error('Failed to fetch event:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Reset the "read more" state whenever the event changes so an edit
  // that shrinks the description doesn't leave the veil hidden.
  useEffect(() => {
    setDescExpanded(false);
  }, [event?.description]);

  useLayoutEffect(() => {
    const el = descRef.current;
    if (!el) return;
    // scrollHeight includes clipped overflow; a 2px slack absorbs the
    // rare rounding difference so text that fits exactly doesn't
    // trigger the veil.
    setDescOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [event?.description, descExpanded]);

  const handleRsvp = useCallback(
    async (status: string) => {
      if (!event) return;
      try {
        const response = await api().post(`/api/v1/events/${event.id}/rsvp`, {
          status,
        });
        setEvent(response.data as Event);
        const [goingRes, interestedRes, notGoingRes] = await Promise.all([
          api().get(`/api/v1/events/${event.id}/attendees`, {
            params: { status: 'going' },
          }),
          api().get(`/api/v1/events/${event.id}/attendees`, {
            params: { status: 'interested' },
          }),
          api().get(`/api/v1/events/${event.id}/attendees`, {
            params: { status: 'not_going' },
          }),
        ]);
        setGoingAttendees(goingRes.data as Attendee[]);
        setInterestedAttendees(interestedRes.data as Attendee[]);
        setNotGoingAttendees(notGoingRes.data as Attendee[]);
      } catch (err) {
        console.error('Failed to RSVP:', err);
      }
    },
    [event],
  );

  const [confirmDialog, confirm] = useConfirmDialog();

  const handleDelete = useCallback(async () => {
    if (!event) return;
    const ok = await confirm({
      title: intl.formatMessage(messages.deleteTitle),
      message: intl.formatMessage(messages.deleteMessage),
      confirmLabel: intl.formatMessage(messages.delete),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api().delete(`/api/v1/events/${event.id}`);
      history.push('/hub/kalendar');
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }, [event, confirm, history, intl]);

  const handleEventUpdated = useCallback((updated: Event) => {
    setEvent(updated);
    setEditing(false);
  }, []);

  const handleInviteSearch = useCallback((query: string) => {
    setInviteQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const response = await api().get('/api/v1/accounts/search', {
            params: { q: query, limit: 6, resolve: false },
          });
          setSearchResults(response.data as SearchAccount[]);
        } catch (err) {
          console.error('Search failed:', err);
        } finally {
          setSearching(false);
        }
      })();
    }, 300);
  }, []);

  const handleInvite = useCallback(
    async (accountId: string) => {
      if (!event) return;
      try {
        await api().post(`/api/v1/events/${event.id}/invite`, {
          account_ids: [accountId],
        });
        setInvitedIds((prev) => new Set(prev).add(accountId));
      } catch (err) {
        console.error('Failed to invite:', err);
      }
    },
    [event],
  );

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
  }, []);
  const handleStartEdit = useCallback(() => {
    setEditing(true);
  }, []);

  // Publish an Edit action into the Ж floating menu when the current
  // viewer owns this event. Registers/unregisters via the shell's
  // <PageActionProvider> so the menu picks it up as an extra moon
  // (Tal 2026-08-28: pencil belongs on an Edit button in the menu,
  // not on the compose one).
  useRegisterPageAction(
    {
      key: 'kalendar-edit-event',
      label: intl.formatMessage(messages.editEvent),
      icon: EditIcon,
      iconId: 'edit',
    },
    handleStartEdit,
    Boolean(event?.is_owner) && !editing,
  );

  const handleToggleInvite = useCallback(() => {
    setShowInvite((prev) => !prev);
  }, []);
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleInviteSearch(e.target.value);
    },
    [handleInviteSearch],
  );
  const handleInviteClickDetail = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      void handleInvite(e.currentTarget.dataset.accountId ?? '');
    },
    [handleInvite],
  );
  const handleToggleRsvp = useCallback(() => {
    void handleRsvp(event?.rsvp === 'going' ? 'remove' : 'going');
  }, [handleRsvp, event?.rsvp]);
  const handleDeleteVoid = useCallback(() => {
    void handleDelete();
  }, [handleDelete]);

  // Share sheet — the Kronk share primitive. Opens on the Share
  // square; offers Send-in-Nudges (mates search → hands off to
  // NudgesThread with the URL pre-attached), Copy link, and native
  // OS share when available.
  const [shareOpen, setShareOpen] = useState(false);
  const handleOpenShare = useCallback(() => {
    setShareOpen(true);
  }, []);
  const handleCloseShare = useCallback(() => {
    setShareOpen(false);
  }, []);

  if (loading || !event) {
    return (
      <Stage label={intl.formatMessage(messages.stageEvent)}>
        <div className='events-page__empty'>
          {intl.formatMessage(messages.loading)}
        </div>
      </Stage>
    );
  }

  if (editing) {
    return (
      <Stage label={intl.formatMessage(messages.stageEdit)}>
        <div className='events-page'>
          <CreateEventForm
            onEventCreated={handleEventUpdated}
            onCancel={handleCancelEdit}
            editEvent={event}
            onDelete={handleDeleteVoid}
          />
        </div>
        {confirmDialog}
      </Stage>
    );
  }

  const isLive =
    event.event_type === 'huddle' &&
    new Date(event.start_time) <= new Date() &&
    (!event.end_time || new Date(event.end_time) > new Date());

  const isPublic =
    event.visibility === 'public' || event.visibility === 'unlisted';

  const renderInviteAction = (account: SearchAccount) => {
    const rsvpStatus = rsvpMap.get(account.id);

    if (rsvpStatus) {
      const config = RSVP_CONFIG[rsvpStatus];
      return (
        <span
          className={`event-detail__invite-status-badge ${config.className}`}
        >
          <Icon id='check' icon={config.icon} />{' '}
          {intl.formatMessage(config.label)}
        </span>
      );
    }

    if (invitedIds.has(account.id)) {
      return (
        <span className='event-detail__invite-btn event-detail__invite-btn--sent'>
          <Icon id='check' icon={CheckIcon} />{' '}
          {intl.formatMessage(messages.invited)}
        </span>
      );
    }

    return (
      <button
        className='event-detail__invite-btn'
        data-account-id={account.id}
        onClick={handleInviteClickDetail}
      >
        <Icon id='person_add' icon={PersonAddIcon} />{' '}
        {intl.formatMessage(messages.invite)}
      </button>
    );
  };

  return (
    <Stage label={event.title}>
      <Helmet>
        <title>{event.title}</title>
      </Helmet>

      {confirmDialog}

      <KornerDetail
        className='event-detail'
        // No `back` chip — the Frame's space header at the top of the
        // page already carries the back-to-Kalendar affordance, so a
        // second in-column chip was reading as a redundant duplicate
        // ("Kalendar" twice). Third round of this: #1573 shipped the
        // chip as "All events"; #1603 changed it to "Kalendar" to
        // match korner identity; #1605 walked back to "All events" to
        // stop the collision. Now removed entirely so the two-nav
        // situation cannot recur. Deep-linked arrivals still land
        // fine — the Frame chip navigates back to Kalendar; the
        // browser back button handles history. Rationale left inline
        // so a future "add a back chip here" gets caught in review.
        hero={
          event.image_url ? (
            <div
              className='event-detail__cover'
              style={{ backgroundImage: `url(${event.image_url})` }}
            />
          ) : null
        }
        banner={isLive ? intl.formatMessage(messages.liveNow) : null}
        title={event.title}
        // Huddles are live rooms — keep the videocam glyph. In-person
        // events get the Kalendar Spiral (the korner's actual icon,
        // per config/korners/kalendar.yaml) rather than the stock
        // Material calendar_month, which drifted onto the title
        // pre-manifest.
        titleIcon={event.event_type === 'huddle' ? VideocamIcon : SpiralIcon}
        titleIconId={event.event_type === 'huddle' ? 'videocam' : 'spiral'}
      >
        {/* Description first, right under the title (Tal 2026-08-28
            — "Description should be directly under the event name").
            When the text overflows the clamped box, a soft veil fades
            it out with a "Read more" chip below. Once expanded the
            veil is dropped and the full text reads through. */}
        {event.description && (
          <div
            className={`event-detail__description${
              descOverflows && !descExpanded
                ? ' event-detail__description--clamped'
                : ''
            }`}
          >
            <div ref={descRef} className='event-detail__description__text'>
              {event.description}
            </div>
            {descOverflows && !descExpanded && (
              <button
                type='button'
                className='event-detail__description__more'
                onClick={handleExpandDesc}
              >
                {intl.formatMessage(messages.readMore)}
              </button>
            )}
          </div>
        )}

        <div className='event-detail__when'>
          <div className='event-detail__when__weekday'>
            <FormattedDate value={event.start_time} weekday='long' />
          </div>
          <div className='event-detail__when__date'>
            <FormattedDate
              value={event.start_time}
              day='numeric'
              month='long'
              year='numeric'
            />
          </div>
          <div className='event-detail__when__time'>
            <FormattedTime value={event.start_time} />
            {event.end_time && (
              <>
                {' – '}
                <FormattedTime value={event.end_time} />
              </>
            )}
          </div>
        </div>

        {event.location_name &&
          (() => {
            // Route the location link through the Map korner when the
            // event has a parseable OSM pin — that way the tap opens
            // the event's own pin on the Kronk Map (with preview card)
            // instead of an OSM page (Tal 2026-08-28: the Kalendar ↔
            // Map bridge). When there's no OSM pin, fall back to the
            // raw location_url so at least the classic behaviour is
            // preserved for hand-typed URLs.
            const pinAvailable = parseOsmUrl(event.location_url) !== null;
            const mapHref = `/hub/map?event=${encodeURIComponent(event.slug ?? event.id)}`;
            return (
              <div className='event-detail__location'>
                <Icon
                  id='location_on'
                  icon={LocationOnIcon}
                  className='event-detail__location__pin'
                />
                {pinAvailable ? (
                  <Link className='event-detail__location__label' to={mapHref}>
                    {event.location_name}
                  </Link>
                ) : event.location_url ? (
                  <a
                    className='event-detail__location__label'
                    href={event.location_url}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {event.location_name}
                  </a>
                ) : (
                  <span className='event-detail__location__label'>
                    {event.location_name}
                  </span>
                )}
                <CopyIconButton
                  title={intl.formatMessage(messages.copyAddress)}
                  value={event.location_name}
                  className='event-detail__location__copy'
                />
              </div>
            );
          })()}

        {event.recurrence_rule && (
          <div className='event-detail__info-row'>
            <Icon id='repeat' icon={RepeatIcon} />{' '}
            {intl.formatMessage(messages.recurring)}
          </div>
        )}

        {(() => {
          const pin = parseOsmUrl(event.location_url);
          return pin ? (
            <MapPinPreview
              key={`${pin.lat},${pin.lng}`}
              lat={pin.lat}
              lng={pin.lng}
              zoom={pin.zoom}
              className='event-detail__map-preview'
            />
          ) : null;
        })()}

        {/* RSVP / Invite / Share row — icon-only Kronk squares. Sits
            below the map so the top of the page reads as description
            + when + where, and the social affordances park closer to
            the action-heavy bottom (Tal 2026-08-28: "let's move the
            rsvp buttons down to the layer underneath the map"). */}
        <div className='event-detail__actions-row'>
          {event.rsvp_enabled && (
            <button
              type='button'
              className={`event-detail__action-square${event.rsvp === 'going' ? ' event-detail__action-square--active' : ''}`}
              onClick={handleToggleRsvp}
              aria-pressed={event.rsvp === 'going'}
              aria-label={intl.formatMessage(messages.rsvp)}
              title={intl.formatMessage(messages.rsvp)}
            >
              <Icon
                id='check'
                icon={CheckIcon}
                className='event-detail__action-square__icon'
              />
            </button>
          )}
          {isPublic && (
            <button
              type='button'
              className={`event-detail__action-square${showInvite ? ' event-detail__action-square--active' : ''}`}
              onClick={handleToggleInvite}
              aria-pressed={showInvite}
              aria-label={intl.formatMessage(messages.invite)}
              title={intl.formatMessage(messages.invite)}
            >
              <Icon
                id='person_add'
                icon={PersonAddIcon}
                className='event-detail__action-square__icon'
              />
            </button>
          )}
          <button
            type='button'
            className='event-detail__action-square'
            onClick={handleOpenShare}
            aria-label={intl.formatMessage(messages.share)}
            title={intl.formatMessage(messages.share)}
          >
            <Icon
              id='share'
              icon={ShareIcon}
              className='event-detail__action-square__icon'
            />
          </button>
        </div>

        {isLive && event.huddle_url && (
          <a
            href={event.huddle_url}
            target='_blank'
            rel='noopener noreferrer'
            className='event-detail__join-huddle'
          >
            <Icon id='videocam' icon={VideocamIcon} />{' '}
            {intl.formatMessage(messages.joinHuddle)}
          </a>
        )}

        {/* KornerAttachments (docs/korners/adding_a_korner.md (Korner attachments) §4.2).
            Reads from the `/api/v1/attachments?source=kalendar/<id>`
            endpoint; the manifest's `attaches:` list drives which
            target korners the "Attach…" button offers (Phase 3:
            Albutts spawn + Booth link). Renders nothing when there
            are no attachments and the viewer can't add any, so a
            non-owner reading a plain event sees no chrome added. */}
        <AttachmentSection
          korner='kalendar'
          recordId={event.id}
          canManage={event.is_owner}
        />

        {showInvite && (
          <div className='event-detail__invite'>
            <div className='event-detail__invite-search'>
              <input
                type='text'
                value={inviteQuery}
                onChange={handleSearchChange}
                placeholder={intl.formatMessage(messages.searchPlaceholder)}
              />
            </div>

            {searching && (
              <div className='event-detail__invite-empty'>
                {intl.formatMessage(messages.searching)}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className='event-detail__invite-results'>
                {searchResults.map((account) => (
                  <div key={account.id} className='event-detail__invite-result'>
                    <img
                      src={account.avatar}
                      alt=''
                      className='event-detail__invite-avatar'
                    />
                    <div className='event-detail__invite-info'>
                      <span className='event-detail__invite-name'>
                        {account.display_name || account.username}
                      </span>
                      <span className='event-detail__invite-acct'>
                        @{account.acct}
                      </span>
                    </div>
                    {renderInviteAction(account)}
                  </div>
                ))}
              </div>
            )}

            {!searching && inviteQuery.trim() && searchResults.length === 0 && (
              <div className='event-detail__invite-empty'>
                {intl.formatMessage(messages.noResults)}
              </div>
            )}
          </div>
        )}

        {/* Going — the "who said yes" strip. Interested rows are no
            longer surfaced on this page (the UI stopped offering that
            RSVP state in #1603); if the DB still holds pre-existing
            interested rows they'll simply not render here. */}
        {goingAttendees.length > 0 && (
          <div className='event-detail__going'>
            <div className='event-detail__going__header'>
              <span className='event-detail__going__label'>
                {intl.formatMessage(messages.going)}
              </span>
              <span className='event-detail__going__count'>
                · {goingAttendees.length}
              </span>
            </div>
            <div className='event-detail__going__list'>
              {goingAttendees.map((a) => (
                <Link
                  key={a.id}
                  to={`/@${a.username}`}
                  className='event-detail__going__chip'
                >
                  <img
                    src={a.avatar}
                    alt=''
                    className='event-detail__going__avatar'
                  />
                  <span className='event-detail__going__name'>
                    {a.display_name || a.username}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </KornerDetail>

      <ShareSheet
        open={shareOpen}
        onClose={handleCloseShare}
        url={`${window.location.origin}/kalendar/${event.slug ?? event.id}`}
        title={event.title}
        body={event.description}
        author={{
          name: event.account.display_name.trim() || event.account.username,
          acct: event.account.acct,
          avatar: event.account.avatar,
        }}
      />
    </Stage>
  );
};

export { EventDetail };
