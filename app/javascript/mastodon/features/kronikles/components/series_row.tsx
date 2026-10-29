import { defineMessages, useIntl } from 'react-intl';

import type {
  ApiChronicleJSON,
  ChronicleSeriesRefJSON,
} from 'mastodon/api_types/kronikles';
import { Icon } from 'mastodon/components/icon';
import { SpaceCard } from 'mastodon/components/space_grid';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// A Series in the Kronikles directory (docs/spaces/kronikles.md, Series):
// one tile for the whole Series, where its newest chapter you can see
// would be, in the same tile as a single Kronikle (the shared SpaceCard),
// with the Series' cover when it has one.
// It opens the Series' contents.

const messages = defineMessages({
  badge: { id: 'kronikles.series.badge', defaultMessage: 'Series' },
  chapters: {
    id: 'kronikles.series.chapter_count',
    defaultMessage: '{count, plural, one {# chapter} other {# chapters}}',
  },
});

interface Props {
  // The newest chapter the directory listed for this Series.
  chronicle: ApiChronicleJSON;
  series: ChronicleSeriesRefJSON;
}

export const SeriesRow: React.FC<Props> = ({ chronicle, series }) => {
  const intl = useIntl();
  const glyph = useKornerIcon('kronikles');

  return (
    <SpaceCard
      to={`/hub/kronikles/series/${series.id}`}
      image={series.cover_url ?? chronicle.pictures[0]?.preview_url ?? null}
      placeholder={<Icon id='korner-kronikles' icon={glyph} />}
      title={series.title}
      meta={`${intl.formatMessage(messages.chapters, {
        count: series.chapter_count,
      })} · @${chronicle.owner.acct}`}
      tag={intl.formatMessage(messages.badge)}
    />
  );
};
