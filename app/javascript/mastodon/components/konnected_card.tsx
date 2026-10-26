import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { KonnectedPreviewJSON } from 'mastodon/api/attachments';
import { MapPinPreview } from 'mastodon/components/map_pin_preview';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// KonnectedCard — a Konnected record shown as itself on another record's
// page (decisions.md, 2026-10-26, "Konnected records show themselves"): a
// Place as its map, an album as its photos, an event as its date, a set or
// a film as its picture, a kronikle as its opening lines. The server sends
// what to draw (`preview`, Kronk::KonnectedPreview); a record with nothing
// to draw stays a space tile (`hasCard`). AttachmentSection mounts it, with
// the same audience marker, Same as and Diskonnect as a tile.

const messages = defineMessages({
  photos: {
    id: 'konnected_card.photos',
    defaultMessage: '{count, plural, one {# photo} other {# photos}}',
  },
});

type Visual = 'map' | 'photos' | 'date' | 'image' | 'text';

// What the card leads with, or null for a tile.
const visualFor = (
  slug: string,
  preview: KonnectedPreviewJSON | null | undefined,
): Visual | null => {
  if (!preview) return null;
  if (slug === 'map')
    return preview.latitude != null && preview.longitude != null ? 'map' : null;
  if (slug === 'albutts') return preview.photos?.length ? 'photos' : null;
  if (slug === 'kalendar') return preview.start_time ? 'date' : null;
  if (preview.image) return 'image';
  if (preview.line) return 'text';
  return null;
};

export const hasCard = (
  slug: string,
  preview: KonnectedPreviewJSON | null | undefined,
) => visualFor(slug, preview) !== null;

interface Props {
  slug: string;
  title: string;
  // What it is ("event", "Krew"), over its title.
  noun: string | null;
  url: string | null;
  preview: KonnectedPreviewJSON;
  // This record's audience follows the card's ("Same as").
  leads: boolean;
  // Who sees it: the AudienceMarker.
  marker: React.ReactNode;
  // Same as and Diskonnect, drawn over the card's corner.
  controls: React.ReactNode;
}

export const KonnectedCard: React.FC<Props> = ({
  slug,
  title,
  noun,
  url,
  preview,
  leads,
  marker,
  controls,
}) => {
  const intl = useIntl();
  const KornerIcon = useKornerIcon(slug);
  const visual = visualFor(slug, preview);

  let media: React.ReactNode = null;
  let line: string | null = null;
  if (
    visual === 'map' &&
    preview.latitude != null &&
    preview.longitude != null
  ) {
    media = (
      <MapPinPreview
        lat={preview.latitude}
        lng={preview.longitude}
        className='konnected-card__map'
      />
    );
    line = preview.address ?? null;
  } else if (visual === 'photos' && preview.photos) {
    media = (
      <div
        className={`konnected-card__photos konnected-card__photos--${Math.min(preview.photos.length, 4)}`}
      >
        {preview.photos.map((src) => (
          <img key={src} src={src} alt='' loading='lazy' />
        ))}
      </div>
    );
    line = intl.formatMessage(messages.photos, {
      count: preview.photo_count ?? preview.photos.length,
    });
  } else if (visual === 'date' && preview.start_time) {
    const starts = new Date(preview.start_time);
    media = (
      <div className='konnected-card__date' aria-hidden='true'>
        <span className='konnected-card__day'>
          {intl.formatDate(starts, { day: 'numeric' })}
        </span>
        <span className='konnected-card__month'>
          {intl.formatDate(starts, { month: 'short' })}
        </span>
      </div>
    );
    line = [
      intl.formatDate(starts, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }),
      preview.location,
    ]
      .filter(Boolean)
      .join(' · ');
  } else if (visual === 'image' && preview.image) {
    media = (
      <img
        className='konnected-card__image'
        src={preview.image}
        alt=''
        loading='lazy'
      />
    );
    line = preview.line ?? null;
  } else if (visual === 'text') {
    line = preview.line ?? null;
  }

  const body = (
    <>
      {media && <div className='konnected-card__media'>{media}</div>}
      <div className='konnected-card__text'>
        {noun && <span className='konnected-card__kind'>{noun}</span>}
        <span className='konnected-card__title'>
          <KornerIcon className='konnected-card__glyph' />
          <span>{title}</span>
        </span>
        {line && (
          <span
            className={`konnected-card__line${visual === 'text' ? ' konnected-card__line--quote' : ''}`}
          >
            {line}
          </span>
        )}
        {marker}
      </div>
    </>
  );
  const className = `konnected-card konnected-card--${visual ?? 'text'}${leads ? ' konnected-card--leads' : ''}`;

  return (
    <li>
      {url ? (
        <Link to={url} className={className}>
          {body}
        </Link>
      ) : (
        <span className={className}>{body}</span>
      )}
      {controls}
    </li>
  );
};
