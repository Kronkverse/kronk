import { useEffect, useState, useCallback } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import NotificationsIcon from '@/material-icons/400-24px/notifications.svg?react';
import { apiRequestGet } from 'mastodon/api';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';

// Aggregated activity feed powered by Nudges::Aggregator on the server.
// Each row is a collapsed group — e.g. "3 froths on your post" — not a
// per-notification card. Sits alongside the main Nudges chat surface
// as the "what's happening with your stuff" view (spec §N).

const messages = defineMessages({
  title: { id: 'nudges_activity.title', defaultMessage: 'Activity' },
});

interface ActorJSON {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
}

interface ActivityGroup {
  id: string;
  type: string;
  subject_type: string | null;
  subject_id: string | null;
  count: number;
  latest_at: string;
  actors: ActorJSON[];
  notification?: unknown;
}

// Verb templates per notification type. Keeps the aggregation output
// legible without needing i18n strings for every distinct verb yet.
const VERB: Record<string, { one: string; many: string }> = {
  favourite: { one: 'frothed your post', many: 'frothed your post' },
  reblog: { one: 'boosted your post', many: 'boosted your post' },
  mention: { one: 'mentioned you', many: 'mentioned you' },
  follow: { one: 'followed you', many: 'followed you' },
  follow_request: {
    one: 'requested to follow you',
    many: 'requested to follow you',
  },
  poll: {
    one: 'a poll you voted in has ended',
    many: 'polls you voted in have ended',
  },
  quote: { one: 'quoted your post', many: 'quoted your post' },
  event_invitation: {
    one: 'invited you to an event',
    many: 'invited you to events',
  },
  media_tag: { one: 'tagged you in media', many: 'tagged you in media' },
};

const describeVerb = (type: string, count: number): string =>
  count > 1 ? (VERB[type]?.many ?? type) : (VERB[type]?.one ?? type);

const ActorAvatars: React.FC<{ actors: ActorJSON[] }> = ({ actors }) => {
  const shown = actors.slice(0, 3);
  return (
    <div className='nudges-activity__actors'>
      {shown.map((a, i) => (
        <Link key={a.id} to={`/@${a.acct}`} title={a.display_name || a.acct}>
          <img
            src={a.avatar}
            alt=''
            className='nudges-activity__actor-avatar'
            style={{ zIndex: shown.length - i }}
          />
        </Link>
      ))}
    </div>
  );
};

const ActivityRow: React.FC<{ group: ActivityGroup }> = ({ group }) => {
  const primary = group.actors[0];
  const others = group.actors.length - 1;
  const nameChunk = primary
    ? primary.display_name || `@${primary.acct}`
    : 'Someone';

  return (
    <li className='nudges-activity__row'>
      <ActorAvatars actors={group.actors} />
      <div className='nudges-activity__body'>
        <p className='nudges-activity__summary'>
          <strong>{nameChunk}</strong>
          {group.count > 1 && others > 0 && (
            <> and {others === 1 ? '1 other' : `${others} others`}</>
          )}
          {group.count > 1 && others === 0 && <> ({group.count})</>}{' '}
          {describeVerb(group.type, group.count)}
        </p>
        <p className='nudges-activity__timestamp'>
          <RelativeTimestamp timestamp={group.latest_at} />
        </p>
      </div>
    </li>
  );
};

export const NudgesActivity: React.FC<{ multiColumn?: boolean }> = ({
  multiColumn,
}) => {
  const intl = useIntl();
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequestGet<ActivityGroup[]>('v1/nudges/activity', {
        limit: 40,
      });
      setGroups(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='notifications'
        iconComponent={NotificationsIcon}
        showBackButton
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='nudges-activity scrollable'>
        <div className='nudges-activity__tabs'>
          <Link to='/nudges' className='nudges-activity__tab'>
            <FormattedMessage
              id='nudges_activity.tab_chat'
              defaultMessage='Chat'
            />
          </Link>
          <span className='nudges-activity__tab nudges-activity__tab--active'>
            <FormattedMessage
              id='nudges_activity.tab_activity'
              defaultMessage='Activity'
            />
          </span>
        </div>

        {error && (
          <p className='nudges-activity__error'>
            <FormattedMessage
              id='nudges_activity.error'
              defaultMessage='Could not load activity.'
            />{' '}
            {error}
          </p>
        )}

        {loading && groups.length === 0 && !error && (
          <p className='nudges-activity__empty'>
            <FormattedMessage
              id='nudges_activity.loading'
              defaultMessage='Loading…'
            />
          </p>
        )}

        {!loading && !error && groups.length === 0 && (
          <p className='nudges-activity__empty'>
            <FormattedMessage
              id='nudges_activity.empty'
              defaultMessage='Nothing new — everything is quiet on your posts and connections right now.'
            />
          </p>
        )}

        <ul className='nudges-activity__list'>
          {groups.map((g) => (
            <ActivityRow key={g.id} group={g} />
          ))}
        </ul>
      </div>
    </Column>
  );
};

export default NudgesActivity;
