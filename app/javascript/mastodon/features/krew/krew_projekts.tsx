import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiFtdProjects } from 'mastodon/api/freethedream';
import type { FtdProjectSummary } from 'mastodon/api_types/freethedream';
import { Icon } from 'mastodon/components/icon';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import { projectPath } from 'mastodon/features/freethedream/components/shared';
import { konnectSearch } from 'mastodon/hooks/useKonnect';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// A Krew's projekts, under its spaces (docs/spaces/krew.md, Projekts): a
// row of their cards, each opening the projekt, and for a member a last
// card that starts a new one in this Krew. Who sees them follows the Krew
// (Freethedream::Project#visible_to?), so the server lists only what the
// viewer could open. A Krew with none has no section (Tal, 2026-10-31: a
// Krew shows only what it has); the first one is seeded from Konnect.
// `onCount` tells the page how many, for its Projekts tile.

const messages = defineMessages({
  title: { id: 'krew.projekts.title', defaultMessage: 'Projekts' },
  newProjekt: { id: 'krew.projekts.new', defaultMessage: 'New projekt' },
  sorted: {
    id: 'krew.projekts.sorted',
    defaultMessage: '{sorted} of {total} sorted',
  },
  done: { id: 'krew.projekts.done', defaultMessage: 'Done' },
});

export const KrewProjekts: React.FC<{
  krewId: string;
  canStart: boolean;
  id?: string;
  onCount?: (count: number) => void;
}> = ({ krewId, canStart, id, onCount }) => {
  const intl = useIntl();
  const projektGlyph = useKornerIcon('freethedream');
  const [projekts, setProjekts] = useState<FtdProjectSummary[] | null>(null);

  useEffect(() => {
    setProjekts(null);
    apiFtdProjects('all', krewId)
      .then(setProjekts)
      .catch(() => {
        setProjekts([]);
      });
  }, [krewId]);

  const count = projekts?.length;
  useEffect(() => {
    if (count !== undefined) onCount?.(count);
  }, [count, onCount]);

  if (!projekts || projekts.length === 0) return null;

  return (
    <section id={id} className='krew-detail__section krew-detail__projekts'>
      <h3 className='korner-section-heading'>
        {intl.formatMessage(messages.title)}
      </h3>

      <SpaceGrid layout='row'>
        {projekts.map((p) => (
          <SpaceCard
            key={p.id}
            to={projectPath(p)}
            image={p.image_url}
            placeholder={<Icon id='korner-freethedream' icon={projektGlyph} />}
            title={p.title}
            meta={
              p.done
                ? intl.formatMessage(messages.done)
                : p.progress.total > 0
                  ? intl.formatMessage(messages.sorted, {
                      sorted: p.progress.sorted,
                      total: p.progress.total,
                    })
                  : undefined
            }
          />
        ))}
        {canStart && (
          <SpaceCard
            to={`/hub/krew/composer/projekt${konnectSearch('krew', krewId)}`}
            placeholder='+'
            title={intl.formatMessage(messages.newProjekt)}
          />
        )}
      </SpaceGrid>
    </section>
  );
};
