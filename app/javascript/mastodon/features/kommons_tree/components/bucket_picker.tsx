import { defineMessages, useIntl } from 'react-intl';

import type { Bucket, KommonsNode } from '../data/nodes';
import { bucketTotals } from '../data/nodes';

const messages = defineMessages({
  intro: {
    id: 'kommons_tree.intro',
    defaultMessage: 'Where in Kronk is this about? Pick a space — every page inside it is a place you can plant feedback.',
  },
  feed: { id: 'kommons_tree.bucket.feed', defaultMessage: 'Feed' },
  profile: { id: 'kommons_tree.bucket.profile', defaultMessage: 'Profile' },
  hub: { id: 'kommons_tree.bucket.hub', defaultMessage: 'Hub' },
  feedBlurb: { id: 'kommons_tree.bucket.feed_blurb', defaultMessage: 'Home timeline, nudges activity' },
  profileBlurb: { id: 'kommons_tree.bucket.profile_blurb', defaultMessage: 'Anyone\u2019s profile, your own settings' },
  hubBlurb: { id: 'kommons_tree.bucket.hub_blurb', defaultMessage: 'Every korner and its pages' },
  proposals: { id: 'kommons_tree.open_count', defaultMessage: '{count, plural, one {# open proposal} other {# open proposals}}' },
});

interface Props {
  nodes: KommonsNode[];
  onSelect: (bucket: Bucket) => void;
}

export const BucketPicker: React.FC<Props> = ({ nodes, onSelect }) => {
  const intl = useIntl();
  const totals = bucketTotals(nodes);

  const buckets: { key: Bucket; label: string; blurb: string; glyph: string }[] = [
    { key: 'feed', label: intl.formatMessage(messages.feed), blurb: intl.formatMessage(messages.feedBlurb), glyph: '\u2261' },
    { key: 'profile', label: intl.formatMessage(messages.profile), blurb: intl.formatMessage(messages.profileBlurb), glyph: '\u25CB' },
    { key: 'hub', label: intl.formatMessage(messages.hub), blurb: intl.formatMessage(messages.hubBlurb), glyph: '\u25A2' },
  ];

  const handleClick = (bucket: Bucket) => () => {
    onSelect(bucket);
  };

  return (
    <div className='kommons-tree__picker'>
      <p className='kommons-tree__intro'>{intl.formatMessage(messages.intro)}</p>
      <div className='kommons-tree__bucket-grid'>
        {buckets.map(b => (
          <button
            key={b.key}
            type='button'
            className={`kommons-tree__bucket kommons-tree__bucket--${b.key}`}
            onClick={handleClick(b.key)}
          >
            <span className='kommons-tree__bucket-glyph' aria-hidden='true'>{b.glyph}</span>
            <span className='kommons-tree__bucket-label'>{b.label}</span>
            <span className='kommons-tree__bucket-blurb'>{b.blurb}</span>
            <span className='kommons-tree__bucket-count'>
              {intl.formatMessage(messages.proposals, { count: totals[b.key] })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
