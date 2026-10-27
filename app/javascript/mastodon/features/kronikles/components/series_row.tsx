import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type {
  ApiChronicleJSON,
  ChronicleSeriesRefJSON,
} from 'mastodon/api_types/kronikles';

// A Series in the Kronikles directory (docs/spaces/kronikles.md, Series):
// one entry for the whole Series, where its newest chapter you can see
// would be, in the same card as a single Kronikle. It opens the Series'
// contents.

const messages = defineMessages({
  badge: { id: 'kronikles.series.badge', defaultMessage: 'Series' },
  summary: {
    id: 'kronikles.series.row_summary',
    defaultMessage:
      '{count, plural, one {# chapter} other {# chapters}} · Latest: {title}',
  },
});

interface Props {
  // The newest chapter the directory listed for this Series.
  chronicle: ApiChronicleJSON;
  series: ChronicleSeriesRefJSON;
}

export const SeriesRow: React.FC<Props> = ({ chronicle, series }) => {
  const intl = useIntl();

  return (
    <li className='kronikles-directory__row'>
      <Link
        to={`/hub/kronikles/series/${series.id}`}
        className='kronikles-card kronikles-card--series'
      >
        <div className='kronikles-card__kind'>
          {intl.formatMessage(messages.badge)}
        </div>
        <div className='kronikles-card__title'>{series.title}</div>
        <p className='kronikles-card__excerpt'>
          {intl.formatMessage(messages.summary, {
            count: series.chapter_count,
            title: chronicle.title,
          })}
        </p>
        <div className='kronikles-card__owner'>@{chronicle.owner.acct}</div>
      </Link>
    </li>
  );
};
