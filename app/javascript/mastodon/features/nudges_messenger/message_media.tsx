import { useCallback, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import type { ApiNudgeMessageJSON } from 'mastodon/api_types/nudges_conversations';

type Media = ApiNudgeMessageJSON['media'][number];

// The pictures, videos and sounds sent with a message. Each is drawn as
// what it is: a sound used to fall through to <img> and show as a broken
// picture, and so did anything whose file wasn't there.
export const MessageMediaGrid: React.FC<{
  media: ApiNudgeMessageJSON['media'];
}> = ({ media }) => {
  const count = Math.min(media.length, 4);
  return (
    <div className={`nudges-msg__media-grid nudges-msg__media-grid--${count}`}>
      {media.map((m) => (
        <MessageMediaTile key={m.id} media={m} />
      ))}
    </div>
  );
};

const MessageMediaTile: React.FC<{ media: Media }> = ({ media }) => {
  const [failed, setFailed] = useState(false);
  const handleError = useCallback(() => {
    setFailed(true);
  }, []);

  if (media.processing) {
    return (
      <div className='nudges-msg__media nudges-msg__media-missing'>
        <FormattedMessage
          id='nudges.media.processing'
          defaultMessage='Still getting this ready'
        />
      </div>
    );
  }

  if (failed || !media.url) return <MissingMedia media={media} />;

  if (media.type === 'video' || media.type === 'gifv') {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        className='nudges-msg__media'
        src={media.url}
        poster={media.preview_url ?? undefined}
        controls
        playsInline
        onError={handleError}
      />
    );
  }

  if (media.type === 'audio') {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <audio
        className='nudges-msg__media-audio'
        src={media.url}
        controls
        onError={handleError}
      />
    );
  }

  if (media.type !== 'image') return <MissingMedia media={media} />;

  return (
    <img
      className='nudges-msg__media'
      src={media.preview_url ?? media.url}
      alt={media.description ?? ''}
      onError={handleError}
    />
  );
};

// In place of a broken picture: say it couldn't be shown, and link the
// original when there is one to open.
const MissingMedia: React.FC<{ media: Media }> = ({ media }) => (
  <div className='nudges-msg__media nudges-msg__media-missing'>
    <FormattedMessage
      id='nudges.media.missing'
      defaultMessage="This couldn't be shown"
    />
    {media.url && (
      <a href={media.url} target='_blank' rel='noopener noreferrer'>
        <FormattedMessage id='nudges.media.open' defaultMessage='Open it' />
      </a>
    )}
  </div>
);
