import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';

import { Link } from 'react-router-dom';

import { showAlertForError } from 'mastodon/actions/alerts';
import { apiRequestDelete, apiRequestGet, apiRequestPost } from 'mastodon/api';
import { me } from 'mastodon/initial_state';
import { useAppDispatch } from 'mastodon/store';

import { UnlinkButton } from './krew_albums';
import { KrewLinkPicker } from './krew_link_picker';
import type { LinkChoice } from './krew_link_picker';

// A Krew's events, on its page (Kommons "Krew-Specific Events"): events
// whose audience includes this Krew, what's coming up and what's been.
// Shown when its Kalendar tile is open. Making one is the Ж menu's +; a member can
// also link one of their own events, coming up first and past ones on asking,
// and any member can unlink one (docs/spaces/krew.md, Linking).

interface KrewEvent {
  id: string;
  slug: string | null;
  title: string;
  start_time: string;
  location_name: string | null;
  invite_only?: boolean;
  // An event made without a post can't take a Krew as its audience.
  status_id?: string | null;
  account?: { id: string };
}

const messages = defineMessages({
  title: { id: 'krew.events.title', defaultMessage: 'Events' },
  past: { id: 'krew.events.past', defaultMessage: 'Earlier' },
  empty: {
    id: 'krew.events.empty',
    defaultMessage:
      'Nothing coming up for this Krew yet. The + in the Ж menu makes an event for it.',
  },
  link: { id: 'krew.events.link', defaultMessage: 'Link one of your events' },
  linkNoneUpcoming: {
    id: 'krew.events.link_none_upcoming',
    defaultMessage: 'You have nothing coming up to link.',
  },
  linkPast: {
    id: 'krew.events.link_past',
    defaultMessage: 'Link a past event',
  },
  linkNonePast: {
    id: 'krew.events.link_none_past',
    defaultMessage: 'You have no past events to link.',
  },
  unlink: { id: 'krew.events.unlink', defaultMessage: 'Unlink' },
});

const when = (intl: IntlShape, iso: string) =>
  intl.formatDate(iso, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

export const KrewEvents: React.FC<{
  krewId: string;
  // The viewer is in a Krew that isn't archived: they can link and unlink.
  canLink?: boolean;
  // Open "Link one of your events" once the Krew's events are in (the
  // space was just added).
  openLink?: boolean;
}> = ({ krewId, canLink = false, openLink = false }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [events, setEvents] = useState<KrewEvent[] | null>(null);
  const [past, setPast] = useState<KrewEvent[]>([]);
  const [choices, setChoices] = useState<LinkChoice[] | null>(null);
  const [pastChoices, setPastChoices] = useState<LinkChoice[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([
        apiRequestGet<KrewEvent[]>('v1/events', { krew_id: krewId }),
        apiRequestGet<KrewEvent[]>('v1/events', {
          krew_id: krewId,
          filter: 'past',
        }),
      ])
        .then(([upcoming, earlier]) => {
          setEvents(upcoming);
          setPast(earlier);
        })
        .catch(() => {
          setEvents([]);
        }),
    [krewId],
  );

  useEffect(() => {
    setEvents(null);
    setPast([]);
    setChoices(null);
    setPastChoices(null);
    void load();
  }, [load]);

  // Your own events not in the Krew yet: coming up (soonest first) or past
  // (most recent first), each its own page from the server.
  const fetchChoices = useCallback(
    (range: 'upcoming' | 'past') =>
      apiRequestGet<KrewEvent[]>('v1/events', { filter: 'mine', when: range })
        .then((mine) => {
          const linked = new Set([...(events ?? []), ...past].map((e) => e.id));
          return mine
            .filter((e) => !linked.has(e.id) && !e.invite_only && e.status_id)
            .map((e) => ({
              id: e.id,
              label: e.title,
              detail: when(intl, e.start_time),
            }));
        })
        .catch(() => [] as LinkChoice[]),
    [events, past, intl],
  );

  const openPicker = useCallback(() => {
    if (choices) {
      setChoices(null);
      setPastChoices(null);
      return;
    }
    void fetchChoices('upcoming').then(setChoices);
  }, [choices, fetchChoices]);

  const openPast = useCallback(() => {
    void fetchChoices('past').then(setPastChoices);
  }, [fetchChoices]);

  // Waits for the Krew's events, so the list leaves out ones already here.
  const linkOpened = useRef(false);
  useEffect(() => {
    if (!openLink || !canLink || events === null || linkOpened.current) return;
    linkOpened.current = true;
    openPicker();
  }, [openLink, canLink, events, openPicker]);

  const link = useCallback(
    (eventId: string) => {
      setBusy(true);
      apiRequestPost(`v1/events/${eventId}/krews`, { krew_id: krewId })
        .then(() => load())
        .then(() => {
          setChoices(null);
          setPastChoices(null);
        })
        .catch((error: unknown) => {
          dispatch(showAlertForError(error));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [krewId, load, dispatch],
  );

  const unlink = useCallback(
    (eventId: string) => {
      setBusy(true);
      apiRequestDelete(`v1/events/${eventId}/krews/${krewId}`)
        .then(() => load())
        .catch((error: unknown) => {
          dispatch(showAlertForError(error));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [krewId, load, dispatch],
  );

  const renderList = (list: KrewEvent[]) => (
    <ul className='krew-detail__event-list'>
      {list.map((event) => (
        <li key={event.id} className='krew-detail__linked'>
          <Link
            to={`/hub/kalendar/${event.slug ?? event.id}`}
            className='krew-detail__event'
          >
            <span className='krew-detail__event-when'>
              {when(intl, event.start_time)}
            </span>
            <span className='krew-detail__event-title'>{event.title}</span>
            {event.location_name && (
              <span className='krew-detail__event-where'>
                {event.location_name}
              </span>
            )}
          </Link>
          {/* Either end can unlink (decisions.md, 2026-10-21): the
              event's maker, or anyone in the Krew. */}
          {(canLink || event.account?.id === me) && (
            <UnlinkButton
              id={event.id}
              label={intl.formatMessage(messages.unlink)}
              disabled={busy}
              onUnlink={unlink}
            />
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <section className='krew-detail__section krew-detail__events'>
      <h3 className='krew-detail__section-heading'>
        {intl.formatMessage(messages.title)}
      </h3>

      {events?.length === 0 && (
        <p className='krew-detail__section-hint'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      {events && events.length > 0 && renderList(events)}

      {past.length > 0 && (
        <>
          <h4 className='krew-detail__subheading'>
            {intl.formatMessage(messages.past)}
          </h4>
          {renderList(past)}
        </>
      )}

      {canLink && (
        <>
          <button
            type='button'
            className='krew-detail__link-toggle'
            onClick={openPicker}
            aria-expanded={choices !== null}
          >
            {intl.formatMessage(messages.link)}
          </button>
          <KrewLinkPicker
            choices={choices}
            emptyLabel={intl.formatMessage(messages.linkNoneUpcoming)}
            disabled={busy}
            onPick={link}
          />
          {choices !== null && pastChoices === null && (
            <button
              type='button'
              className='krew-detail__link-toggle'
              onClick={openPast}
            >
              {intl.formatMessage(messages.linkPast)}
            </button>
          )}
          {pastChoices !== null && (
            <h4 className='krew-detail__subheading'>
              {intl.formatMessage(messages.past)}
            </h4>
          )}
          <KrewLinkPicker
            choices={pastChoices}
            emptyLabel={intl.formatMessage(messages.linkNonePast)}
            disabled={busy}
            onPick={link}
          />
        </>
      )}
    </section>
  );
};
