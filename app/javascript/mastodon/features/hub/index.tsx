import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useAllKorners } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';

// Hub landing page (spec §4). Grid of korner cards; every enforced,
// non-hidden korner ships one. Ordered here alphabetically as a first
// pass — the spec's tune-in-count ordering with per-user override is
// wired in Phase 4 once the counts materialised view backfills.

const messages = defineMessages({
  title: { id: 'hub.title', defaultMessage: 'Hub' },
});

const KornerCard: React.FC<{ korner: ApiKornerJSON }> = ({ korner }) => {
  const Icon = useKornerIcon(korner.slug);
  const teaser =
    (korner.hub_teaser?.static as string | undefined) ??
    (korner.launch?.blurb as string | undefined) ??
    '';

  return (
    <Link to={`/hub/${korner.slug}`} className='hub-page__card'>
      <span className='hub-page__card-icon' aria-hidden='true'>
        <Icon />
      </span>
      <div className='hub-page__card-body'>
        <h3 className='hub-page__card-name'>{korner.name}</h3>
        {teaser && <p className='hub-page__card-teaser'>{teaser}</p>}
      </div>
    </Link>
  );
};

const Hub: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const korners = useAllKorners();

  const listed = korners
    .filter((k) => k.enforced !== false)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Column>
      <ColumnHeader title={intl.formatMessage(messages.title)} icon='hub' multiColumn={multiColumn} />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='hub-page'>
        <section className='hub-page__hero'>
          <h1 className='hub-page__hero-title'>
            <FormattedMessage id='hub.hero_title' defaultMessage='Hub' />
          </h1>
          <p className='hub-page__hero-intro'>
            <FormattedMessage
              id='hub.hero_intro'
              defaultMessage='Every korner on this instance. Drop into whichever fits what you feel like doing.'
            />
          </p>
        </section>

        {listed.length === 0 && (
          <p className='hub-page__empty'>
            <FormattedMessage
              id='hub.empty'
              defaultMessage='No korners are loaded yet. This usually means the manifest registry is still fetching.'
            />
          </p>
        )}

        <div className='hub-page__grid'>
          {listed.map((k) => (
            <KornerCard key={k.slug} korner={k} />
          ))}
        </div>
      </div>
    </Column>
  );
};

export default Hub;
