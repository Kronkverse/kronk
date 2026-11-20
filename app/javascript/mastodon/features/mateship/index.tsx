import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, Redirect, useHistory, useParams } from 'react-router-dom';

import { isAxiosError } from 'axios';

import { apiRequestGet } from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import { Stage } from 'mastodon/components/stage';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

// /@:acct/mateship — what you and one Mate share (docs/spaces/profile.md,
// Mateship). Only the two of them can open it: the API answers 404 to
// anyone else, and the page sends them back to the profile. Shared things,
// never measures: no counts of froths, messages or visits between them
// (decisions.md, 2026-11-19). Remove Mate isn't here; it lives on the
// per-person settings page, which this links to (decisions.md, 2026-10-25).

interface MateshipPerson {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
}

interface ApiMateshipJSON {
  since: string | null;
  matuals_count: number;
  matuals: MateshipPerson[];
  krews: {
    id: string;
    slug: string;
    name: string;
    member_count: number;
    image_url: string | null;
  }[];
  events: {
    id: string;
    slug: string | null;
    title: string;
    start_time: string;
    location_name: string | null;
    image_url: string | null;
  }[];
  projekts: {
    id: string;
    title: string;
    krew_slug: string | null;
    cover_url: string | null;
  }[];
}

const messages = defineMessages({
  stage: { id: 'mateship.stage', defaultMessage: 'Mates' },
  title: { id: 'mateship.title', defaultMessage: 'You and {name}' },
  since: { id: 'mateship.since', defaultMessage: 'Mates since {date}' },
  back: { id: 'mateship.back', defaultMessage: 'Back to {name}' },
  loading: { id: 'mateship.loading', defaultMessage: 'Loading…' },
  failed: {
    id: 'mateship.failed',
    defaultMessage: 'This didn’t load. Try again shortly.',
  },
  years: {
    id: 'mateship.length.years',
    defaultMessage: '{count, plural, one {# year} other {# years}}',
  },
  months: {
    id: 'mateship.length.months',
    defaultMessage: '{count, plural, one {# month} other {# months}}',
  },
  weeks: {
    id: 'mateship.length.weeks',
    defaultMessage: '{count, plural, one {# week} other {# weeks}}',
  },
  days: {
    id: 'mateship.length.days',
    defaultMessage: '{count, plural, one {# day} other {# days}}',
  },
  today: { id: 'mateship.length.today', defaultMessage: 'New today' },
  matualsCount: {
    id: 'mateship.matuals_count',
    defaultMessage:
      '{count, plural, one {# Mate in common} other {# Mates in common}}',
  },
  matuals: { id: 'mateship.matuals', defaultMessage: 'Mates in common' },
  krews: { id: 'mateship.krews', defaultMessage: 'Krews you’re both in' },
  events: { id: 'mateship.events', defaultMessage: 'Events together' },
  projekts: {
    id: 'mateship.projekts',
    defaultMessage: 'Projekts you’re both in',
  },
  people: {
    id: 'mateship.krew_people',
    defaultMessage: '{count, plural, one {# person} other {# people}}',
  },
  upcoming: { id: 'mateship.upcoming', defaultMessage: 'Coming up' },
  nothing: {
    id: 'mateship.nothing',
    defaultMessage: 'Nothing shared yet',
  },
  nothingBody: {
    id: 'mateship.nothing_body',
    defaultMessage: 'Krews, events and projekts you’re both in will show here.',
  },
  nudge: { id: 'mateship.nudge', defaultMessage: 'Nudge' },
  settings: {
    id: 'mateship.settings',
    defaultMessage: 'Your settings for {name}',
  },
});

const DAY = 24 * 60 * 60 * 1000;

// Someone without a picture of their own gets their initial, not a big
// tile of the default avatar.
const hasPicture = (url: string) =>
  !url.endsWith('/avatars/original/missing.png');

// How long they've been Mates, in the largest whole unit.
const lengthOf = (since: string) => {
  const days = Math.floor((Date.now() - new Date(since).getTime()) / DAY);
  if (days >= 365)
    return { message: messages.years, count: Math.floor(days / 365) };
  if (days >= 60)
    return { message: messages.months, count: Math.floor(days / 30) };
  if (days >= 14)
    return { message: messages.weeks, count: Math.floor(days / 7) };
  if (days >= 1) return { message: messages.days, count: days };
  return { message: messages.today, count: 0 };
};

export const Mateship: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const { acct } = useParams<{ acct: string }>();
  const nudgesIcon = useKornerIcon('nudges');
  const viewer = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );

  const [account, setAccount] = useState<ApiAccountJSON | null>(null);
  const [mateship, setMateship] = useState<ApiMateshipJSON | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'error'>(
    'loading',
  );

  // Bumped per load, so a slow answer for a handle we've moved on from is
  // dropped (a `cancelled` boolean reads as always-false to the linter).
  const run = useRef(0);

  useEffect(() => {
    run.current += 1;
    const mine = run.current;
    setState('loading');

    void (async () => {
      try {
        const found = await apiRequestGet<ApiAccountJSON>(
          'v1/accounts/lookup',
          { acct },
        );
        const shared = await apiRequestGet<ApiMateshipJSON>(
          `v1/accounts/${found.id}/mateship`,
        );
        if (run.current !== mine) return;
        setAccount(found);
        setMateship(shared);
        setState('ready');
      } catch (error) {
        if (run.current !== mine) return;
        const status = isAxiosError(error) ? error.response?.status : null;
        setState(status === 404 ? 'gone' : 'error');
      }
    })();
  }, [acct]);

  const accountId = account?.id;
  const handleNudge = useCallback(() => {
    if (accountId) history.push(`/nudges/with/${accountId}`);
  }, [accountId, history]);

  // Not your Mate (or not a person): their profile is the page that applies.
  if (state === 'gone') return <Redirect to={`/@${acct}`} />;

  const displayName = account?.display_name.trim();
  // A blank display name falls back to the username.
  const name =
    displayName !== undefined && displayName !== ''
      ? displayName
      : (account?.username ?? acct);

  if (state !== 'ready' || !account || !mateship) {
    return (
      <Stage label={intl.formatMessage(messages.stage)}>
        <div className='stage-column'>
          {state === 'error' ? (
            <EmptyState title={intl.formatMessage(messages.failed)} />
          ) : (
            <LoadingState label={intl.formatMessage(messages.loading)} />
          )}
        </div>
      </Stage>
    );
  }

  const length = mateship.since ? lengthOf(mateship.since) : null;
  const cover = account.header.endsWith('/headers/original/missing.png')
    ? null
    : account.header;
  const now = Date.now();
  // Coming up first (soonest first), then the ones that have been.
  const events = [...mateship.events].sort((a, b) => {
    const at = new Date(a.start_time).getTime();
    const bt = new Date(b.start_time).getTime();
    const aUp = at > now;
    const bUp = bt > now;
    if (aUp !== bUp) return aUp ? -1 : 1;
    return aUp ? at - bt : bt - at;
  });
  const nothingShared =
    mateship.matuals.length === 0 &&
    mateship.krews.length === 0 &&
    mateship.events.length === 0 &&
    mateship.projekts.length === 0;

  return (
    <Stage label={intl.formatMessage(messages.stage)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title, { name })}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      <KornerDetail
        className='mateship'
        back={{
          href: `/@${account.acct}`,
          label: intl.formatMessage(messages.back, { name }),
        }}
        hero={
          // Their cover, when they have one, with the two of you at its foot.
          <div
            className='mateship__faces'
            style={cover ? { backgroundImage: `url(${cover})` } : undefined}
          >
            {viewer && <Avatar account={viewer} size={88} />}
            <Avatar account={account} size={88} />
          </div>
        }
        title={intl.formatMessage(messages.title, { name })}
        subtitle={
          mateship.since
            ? intl.formatMessage(messages.since, {
                date: intl.formatDate(mateship.since, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
              })
            : undefined
        }
        meta={
          <KornerMeta
            items={[
              length &&
                intl.formatMessage(length.message, { count: length.count }),
              mateship.matuals_count > 0 &&
                intl.formatMessage(messages.matualsCount, {
                  count: mateship.matuals_count,
                }),
            ]}
          />
        }
        actions={
          <KornerActionBar>
            <KornerPill
              icon={nudgesIcon}
              iconId='nudge'
              label={intl.formatMessage(messages.nudge)}
              onClick={handleNudge}
            />
          </KornerActionBar>
        }
      >
        {nothingShared && (
          <EmptyState
            title={intl.formatMessage(messages.nothing)}
            body={intl.formatMessage(messages.nothingBody)}
          />
        )}

        {mateship.matuals.length > 0 && (
          <section className='mateship__section'>
            <h2 className='korner-section-heading'>
              <FormattedMessage {...messages.matuals} />
            </h2>
            <SpaceGrid layout='row'>
              {mateship.matuals.map((person) => (
                <SpaceCard
                  key={person.id}
                  to={`/@${person.acct}`}
                  image={hasPicture(person.avatar) ? person.avatar : null}
                  placeholder={person.display_name.slice(0, 1).toUpperCase()}
                  title={person.display_name}
                  meta={`@${person.acct}`}
                />
              ))}
            </SpaceGrid>
          </section>
        )}

        {mateship.krews.length > 0 && (
          <section className='mateship__section'>
            <h2 className='korner-section-heading'>
              <FormattedMessage {...messages.krews} />
            </h2>
            <SpaceGrid>
              {mateship.krews.map((krew) => (
                <SpaceCard
                  key={krew.id}
                  to={`/hub/krew/${krew.slug}`}
                  image={krew.image_url}
                  title={krew.name}
                  meta={intl.formatMessage(messages.people, {
                    count: krew.member_count,
                  })}
                />
              ))}
            </SpaceGrid>
          </section>
        )}

        {events.length > 0 && (
          <section className='mateship__section'>
            <h2 className='korner-section-heading'>
              <FormattedMessage {...messages.events} />
            </h2>
            <SpaceGrid>
              {events.map((event) => (
                <SpaceCard
                  key={event.id}
                  to={`/hub/kalendar/${event.slug ?? event.id}`}
                  image={event.image_url}
                  title={event.title}
                  meta={[
                    intl.formatDate(event.start_time, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }),
                    event.location_name,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  tag={
                    new Date(event.start_time).getTime() > now
                      ? intl.formatMessage(messages.upcoming)
                      : undefined
                  }
                />
              ))}
            </SpaceGrid>
          </section>
        )}

        {mateship.projekts.length > 0 && (
          <section className='mateship__section'>
            <h2 className='korner-section-heading'>
              <FormattedMessage {...messages.projekts} />
            </h2>
            <SpaceGrid>
              {mateship.projekts.map((projekt) => (
                <SpaceCard
                  key={projekt.id}
                  to={
                    projekt.krew_slug
                      ? `/hub/krew/${projekt.krew_slug}/p/${projekt.id}`
                      : `/hub/freethedream/p/${projekt.id}`
                  }
                  image={projekt.cover_url}
                  title={projekt.title}
                />
              ))}
            </SpaceGrid>
          </section>
        )}

        <p className='mateship__settings'>
          <Link to={`/@${account.acct}/settings`}>
            {intl.formatMessage(messages.settings, { name })}
          </Link>
        </p>
      </KornerDetail>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Mateship;
