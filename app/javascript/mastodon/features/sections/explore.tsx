import { useCallback } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { KornerPill } from 'mastodon/components/korner_pill';
import { Stage } from 'mastodon/components/stage';
import { useOpenProposer } from 'mastodon/features/kommons/use_open_proposer';
import { MomentsStrip } from 'mastodon/features/moments/home_strip';
import { useKorners } from 'mastodon/hooks/useKorner';

import { KornerTiles, SectionHeader, useSectionKorners } from './korner_tiles';
import { EXPLORE_KORNERS, placed } from './sections';

// Explore (/explore): what individuals share with the community (Tal,
// 2026-11-01), as collections, with the Moments strip above them. It
// takes over from the Hub; korners no section names yet stay reachable
// here under "Also on Kronk" until later phases place them. Search, in
// the top bar, is the other way in.

const messages = defineMessages({
  title: { id: 'sections.explore.title', defaultMessage: 'Explore' },
  tagline: {
    id: 'sections.explore.tagline',
    defaultMessage: 'What people across Kronk are sharing.',
  },
  collections: {
    id: 'sections.explore.collections',
    defaultMessage: 'Collections',
  },
  more: { id: 'sections.explore.more', defaultMessage: 'Also on Kronk' },
  propose: {
    id: 'sections.explore.propose',
    defaultMessage: 'Propose a new korner',
  },
});

const isLive = (k: { enforced?: boolean; portal?: { url?: string } | null }) =>
  k.enforced !== false || Boolean(k.portal?.url);

const Explore: React.FC = () => {
  const intl = useIntl();
  const collections = useSectionKorners(EXPLORE_KORNERS);
  const others = useKorners()
    .filter((k) => !placed.has(k.slug) && isLive(k))
    .sort((a, b) => a.name.localeCompare(b.name));
  const openProposer = useOpenProposer();
  const handlePropose = useCallback(() => {
    openProposer({ kind: 'new_korner' });
  }, [openProposer]);

  const title = intl.formatMessage(messages.title);

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <div className='section-page section-page--explore'>
        <SectionHeader
          title={title}
          tagline={intl.formatMessage(messages.tagline)}
        />

        <MomentsStrip />

        <section className='section-page__section'>
          <h2 className='korner-section-heading'>
            <FormattedMessage {...messages.collections} />
          </h2>
          <KornerTiles korners={collections} />
        </section>

        {others.length > 0 && (
          <section className='section-page__section'>
            <h2 className='korner-section-heading'>
              <FormattedMessage {...messages.more} />
            </h2>
            <KornerTiles korners={others} />
          </section>
        )}

        <div className='section-page__actions'>
          <KornerPill
            label={intl.formatMessage(messages.propose)}
            onClick={handlePropose}
          />
        </div>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Explore;
