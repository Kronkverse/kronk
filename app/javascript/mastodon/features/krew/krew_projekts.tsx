import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiFtdProjects } from 'mastodon/api/freethedream';
import type { FtdProjectSummary } from 'mastodon/api_types/freethedream';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import { projectPath } from 'mastodon/features/freethedream/components/shared';
import { konnectSearch } from 'mastodon/hooks/useKonnect';

// A Krew's projekts, near the top of its page (docs/spaces/krew.md,
// Projekts): a row of their cards, each opening the projekt, and for a
// member a last card that starts a new one in this Krew. Who sees them
// follows the Krew (Freethedream::Project#visible_to?), so the server
// lists only what the viewer could open.

const messages = defineMessages({
  title: { id: 'krew.projekts.title', defaultMessage: 'Projekts' },
  empty: {
    id: 'krew.projekts.empty',
    defaultMessage:
      'Nothing on the go yet. Start a projekt and everyone in the Krew is in it.',
  },
  newProjekt: { id: 'krew.projekts.new', defaultMessage: 'New projekt' },
  people: {
    id: 'krew.projekts.people',
    defaultMessage: '{count, plural, one {# person} other {# people}}',
  },
  sorted: {
    id: 'krew.projekts.sorted',
    defaultMessage: '{sorted} of {total} sorted',
  },
  done: { id: 'krew.projekts.done', defaultMessage: 'Done' },
});

export const KrewProjekts: React.FC<{
  krewId: string;
  canStart: boolean;
}> = ({ krewId, canStart }) => {
  const intl = useIntl();
  const [projekts, setProjekts] = useState<FtdProjectSummary[] | null>(null);

  useEffect(() => {
    setProjekts(null);
    apiFtdProjects('all', krewId)
      .then(setProjekts)
      .catch(() => {
        setProjekts([]);
      });
  }, [krewId]);

  if (!projekts) return null;
  if (projekts.length === 0 && !canStart) return null;

  return (
    <section className='krew-detail__section krew-detail__projekts'>
      <h3 className='korner-section-heading'>
        {intl.formatMessage(messages.title)}
      </h3>

      {projekts.length === 0 && (
        <p className='krew-detail__section-hint'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      <SpaceGrid layout='row'>
        {projekts.map((p) => (
          <SpaceCard
            key={p.id}
            to={projectPath(p)}
            image={p.image_url}
            placeholder='🌱'
            title={p.title}
            meta={[
              intl.formatMessage(messages.people, { count: p.members_count }),
              p.done
                ? intl.formatMessage(messages.done)
                : p.progress.total > 0 &&
                  intl.formatMessage(messages.sorted, {
                    sorted: p.progress.sorted,
                    total: p.progress.total,
                  }),
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        ))}
        {canStart && (
          <SpaceCard
            to={`/hub/freethedream/composer${konnectSearch('krew', krewId)}`}
            placeholder='+'
            title={intl.formatMessage(messages.newProjekt)}
          />
        )}
      </SpaceGrid>
    </section>
  );
};
