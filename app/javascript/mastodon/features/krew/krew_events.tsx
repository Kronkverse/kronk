import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiRequestDelete, apiRequestGet, apiRequestPost } from 'mastodon/api';
import { me } from 'mastodon/initial_state';

import { UnlinkButton } from './krew_albums';
import { KrewLinkPicker } from './krew_link_picker';
import type { LinkChoice } from './krew_link_picker';

// A Krew's events, on its page (Kommons "Krew-Specific Events"): events
// whose audience includes this Krew, what's coming up and what's been.
// Making one is the Kalendar tile among the Krew's spaces; a member can
// also link one of their own events, past ones included, and unlink it
// (docs/spaces/krew.md, Linking).

interface KrewEvent {
  id: string;
  slug: string | null;
  title: string;
  start_time: string;
  location_name: string | null;
  invite_only?: boolean;
  account?: { id: string };
}

const messages = defineMessages({
  title: { id: 'krew.events.title', defaultMessage: 'Events' },
  past: { id: 'krew.events.past', defaultMessage: 'Earlier' },
  empty: {
    id: 'krew.events.empty',
    defaultMessage:
      'Nothing coming up for this Krew yet. Kalendar, above, makes an event for it.',
  },
  link: { id: 'krew.events.link', defaultMessage: 'Link one of your events' },
  linkNone: {
    id: 'krew.events.link_none',
    defaultMessage: 'You have no other events to link.',
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

export const KrewEvents: React.FC<{ krewId: string; canLink?: boolean }> = ({
  krewId,
  canLink = false,
}) => {
  const intl = useIntl();
  const [events, setEvents] = useState<KrewEvent[] | null>(null);
  const [past, setPast] = useState<KrewEvent[]>([]);
  const [choices, setChoices] = useState<LinkChoice[] | null>(null);
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
    void load();
  }, [load]);

  const openPicker = useCallback(() => {
    if (choices) {
      setChoices(null);
      return;
    }
    apiRequestGet<KrewEvent[]>('v1/events', { filter: 'mine' })
      .then((mine) => {
        const linked = new Set([...(events ?? []), ...past].map((e) => e.id));
        setChoices(
          mine
            .filter((e) => !linked.has(e.id) && !e.invite_only)
            .map((e) => ({
              id: e.id,
              label: e.title,
              detail: when(intl, e.start_time),
            })),
        );
      })
      .catch(() => {
        setChoices([]);
      });
  }, [choices, events, past, intl]);

  const link = useCallback(
    (eventId: string) => {
      setBusy(true);
      apiRequestPost(`v1/events/${eventId}/krews`, { krew_id: krewId })
        .then(() => load())
        .then(() => {
          setChoices(null);
        })
        .catch(() => undefined)
        .finally(() => {
          setBusy(false);
        });
    },
    [krewId, load],
  );

  const unlink = useCallback(
    (eventId: string) => {
      setBusy(true);
      apiRequestDelete(`v1/events/${eventId}/krews/${krewId}`)
        .then(() => load())
        .catch(() => undefined)
        .finally(() => {
          setBusy(false);
        });
    },
    [krewId, load],
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
          {event.account?.id === me && (
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
            emptyLabel={intl.formatMessage(messages.linkNone)}
            disabled={busy}
            onPick={link}
          />
        </>
      )}
    </section>
  );
};
