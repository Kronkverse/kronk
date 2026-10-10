import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';
import { Link } from 'react-router-dom';

import type { ApiNudgeNotificationJSON } from 'mastodon/api_types/nudges_notifications';
import { Avatar } from 'mastodon/components/avatar';
import { KornerGlyph } from 'mastodon/components/korner_glyph';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { useKorner } from 'mastodon/hooks/useKorner';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { genericSentence, sentenceFor, whoMessages } from './notification_copy';

const messages = defineMessages({
  fresh: { id: 'nudges.notification.new', defaultMessage: 'New' },
});

interface ShellProps {
  // An in-app route, or `href` for a page outside the SPA. One of the two.
  to?: string;
  href?: string;
  // Not seen before this visit: tinted, with a dot.
  fresh: boolean;
  // Already dealt with: recedes.
  quiet?: boolean;
  media: React.ReactNode;
  sentence: React.ReactNode;
  subject?: React.ReactNode;
  timestamp: string | null;
  onClick?: () => void;
}

// The one row shape on the Notifications face: who or what on the left, a
// sentence, an optional line quoting what it is about, and when. The whole
// row is a single link — there is one thing to do with a notification, and
// that is go to what it is about.
export const NotificationRowShell: React.FC<ShellProps> = ({
  to,
  href,
  fresh,
  quiet = false,
  media,
  sentence,
  subject,
  timestamp,
  onClick,
}) => {
  const intl = useIntl();

  const inner = (
    <>
      <span className='nudges-notification__media'>{media}</span>
      <span className='nudges-notification__body'>
        <span className='nudges-notification__sentence'>{sentence}</span>
        {subject && (
          <span className='nudges-notification__subject'>{subject}</span>
        )}
      </span>
      <span className='nudges-notification__aside'>
        {timestamp && (
          <span className='nudges-notification__time'>
            <RelativeTimestamp timestamp={timestamp} short />
          </span>
        )}
        {fresh && (
          <span
            className='nudges-notification__dot'
            role='img'
            aria-label={intl.formatMessage(messages.fresh)}
          />
        )}
      </span>
    </>
  );

  return (
    <li
      className={classNames('nudges-notification', {
        'nudges-notification--fresh': fresh,
        'nudges-notification--quiet': quiet,
      })}
    >
      {href ? (
        <a href={href} className='nudges-notification__link' onClick={onClick}>
          {inner}
        </a>
      ) : (
        <Link
          to={to ?? '/nudges'}
          className='nudges-notification__link'
          onClick={onClick}
        >
          {inner}
        </Link>
      )}
    </li>
  );
};

// Small korner mark pinned to the corner of the avatar, so the row says
// where it came from without spending a line on it.
const KornerChip: React.FC<{ slug: string }> = ({ slug }) => {
  const korner = useKorner(slug);
  if (!korner) return null;

  return (
    <span className='nudges-notification__korner' title={korner.name}>
      <KornerGlyph slug={slug} aria-hidden />
    </span>
  );
};

interface RowProps {
  item: ApiNudgeNotificationJSON;
  fresh: boolean;
}

export const NotificationRow: React.FC<RowProps> = ({ item, fresh }) => {
  const intl = useIntl();
  const korner = useKorner(item.source_korner_slug);

  const actors = item.actors.map((actor) => createAccountFromServerJSON(actor));
  const [first, second] = actors;
  if (!first) return null;

  const name = (
    <strong key='name'>{first.display_name || first.username}</strong>
  );
  const others = item.count - 1;
  const who =
    others > 0
      ? intl.formatMessage(whoMessages.andOthers, { name, count: others })
      : name;

  const sentence = intl.formatMessage(
    sentenceFor(item.source_korner_slug, item.verb) ?? genericSentence,
    { who, korner: korner?.name ?? item.source_korner_slug },
  );

  return (
    <NotificationRowShell
      to={item.route}
      fresh={fresh}
      timestamp={item.created_at}
      sentence={sentence}
      subject={item.subject}
      media={
        <>
          {second ? (
            <span className='nudges-notification__pair'>
              <Avatar account={first} size={30} />
              <Avatar account={second} size={30} />
            </span>
          ) : (
            <Avatar account={first} size={44} />
          )}
          <KornerChip slug={item.source_korner_slug} />
        </>
      }
    />
  );
};
