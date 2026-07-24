import { Link } from 'react-router-dom';

import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import { Icon } from 'mastodon/components/icon';

// StatusKrewBadge — small named+tappable pill rendered inline in the
// status header when a Status is scoped to one or more Krews.
// KRONK_KREWS §7.2: "each marked with a small named, tappable badge
// (▸ Mayhem Krew) that shows provenance and links to the Krew page."
//
// One chip per targeted Krew — a post can carry N Krews, so we render
// them all. Each chip links to /hub/krew/:slug.

interface KrewRef {
  id: string;
  slug: string;
  name: string;
}

export const StatusKrewBadge: React.FC<{ krews?: KrewRef[] }> = ({ krews }) => {
  if (!krews || krews.length === 0) return null;

  return (
    <span className='status-krew-badge'>
      {krews.map((krew) => (
        <Link
          key={krew.id}
          to={`/hub/krew/${krew.slug}`}
          className='status-krew-badge__chip'
          title={krew.name}
        >
          <Icon
            id='group'
            icon={GroupsIcon}
            className='status-krew-badge__icon'
          />
          <span className='status-krew-badge__name'>{krew.name}</span>
        </Link>
      ))}
    </span>
  );
};
