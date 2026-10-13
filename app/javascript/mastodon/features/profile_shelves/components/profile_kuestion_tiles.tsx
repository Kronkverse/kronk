import { useIntl } from 'react-intl';

import type { ApiPinnedKuestionJSON } from 'mastodon/api_types/kuestions';

import {
  linkHref,
  linkLabel,
  LongtextValue,
  toChips,
} from './profile_fields_display';

// Pinned answers to profile Kuestions members wrote, under the Identity
// lines. Unlike Kronk's own, the question is part of the answer ("Favourite
// tree?" → "Oak"), so each is a tile with both, at the size its owner set.

const PinnedAnswer: React.FC<{ pin: ApiPinnedKuestionJSON }> = ({ pin }) => {
  const intl = useIntl();

  switch (pin.answer_format) {
    case 'longtext':
      return <LongtextValue text={pin.body} />;
    case 'list':
      return (
        <div className='profile-identity__chips'>
          {toChips(pin.body).map((chip) => (
            <span className='profile-identity__chip' key={chip}>
              {chip}
            </span>
          ))}
        </div>
      );
    case 'link':
      return (
        <a
          className='profile-identity__link'
          href={linkHref(pin.body)}
          target='_blank'
          rel='noopener noreferrer'
        >
          {linkLabel(pin.body)}
        </a>
      );
    case 'date':
      return (
        <span>
          {intl.formatDate(`${pin.body}T00:00:00Z`, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </span>
      );
    default:
      return <span>{pin.body}</span>;
  }
};

export const ProfileKuestionTiles: React.FC<{
  pins: ApiPinnedKuestionJSON[];
}> = ({ pins }) => {
  const shown = pins.filter((pin) => !pin.seed_key && pin.body.trim() !== '');
  if (shown.length === 0) return null;

  return (
    <div className='profile-board profile-kuestion-tiles'>
      {shown.map((pin) => (
        <div
          key={pin.question_id}
          className={`profile-board__tile profile-board__tile--${pin.size ?? 'm'} profile-kuestion-tiles__tile`}
        >
          <p className='profile-kuestion-tiles__q'>{pin.title}</p>
          <div className='profile-kuestion-tiles__a'>
            <PinnedAnswer pin={pin} />
          </div>
        </div>
      ))}
    </div>
  );
};
