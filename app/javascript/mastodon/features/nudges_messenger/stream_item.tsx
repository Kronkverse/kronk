import { Link } from 'react-router-dom';

import type { ApiNudgeStreamItem } from 'mastodon/api_types/nudges_conversations';
import { Avatar } from 'mastodon/components/avatar';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { createAccountFromServerJSON } from 'mastodon/models/account';

interface StreamItemProps {
  item: ApiNudgeStreamItem;
}

// One row in the conversation stream — either a message bubble or an
// inline event. Kept in one component so the interleave stays
// obvious; a split becomes worthwhile once each side grows attach
// affordances / reactions.
export const StreamItem: React.FC<StreamItemProps> = ({ item }) => {
  if (item.kind === 'message') {
    return (
      <div
        className={`nudges-msg ${
          item.author_is_self ? 'nudges-msg--out' : 'nudges-msg--in'
        }`}
      >
        <div className='nudges-msg__bubble'>
          {item.body && <span className='nudges-msg__body'>{item.body}</span>}
        </div>
        <span className='nudges-msg__time'>
          <RelativeTimestamp timestamp={item.created_at} short />
        </span>
      </div>
    );
  }

  const actor = createAccountFromServerJSON(item.actor);
  const actorName = actor.display_name || actor.username;

  return (
    <div className={`nudges-event nudges-event--${item.source_korner_slug}`}>
      <span className='nudges-event__orb' aria-hidden />
      <span className='nudges-event__body'>
        <span className='nudges-event__avatar'>
          <Avatar account={actor} size={24} />
        </span>
        <span className='nudges-event__text'>
          <strong>{actorName}</strong> {item.verb}{' '}
          <span className='nudges-event__source'>
            in {item.source_korner_slug}
          </span>
        </span>
        {item.interaction === 'interactive' &&
          item.cta_label &&
          item.cta_route && (
            <Link to={item.cta_route} className='nudges-event__cta'>
              {item.cta_label}
            </Link>
          )}
      </span>
      <span className='nudges-event__time'>
        <RelativeTimestamp timestamp={item.created_at} short />
      </span>
    </div>
  );
};
