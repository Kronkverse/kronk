import { useCallback, useState } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import ExploreIcon from '@/material-icons/400-24px/explore.svg?react';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useAllKorners } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { apiRequestPost, apiRequestDelete } from 'mastodon/api';
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

  const [tunedIn, setTunedIn] = useState(korner.tuned_in !== false);
  const [saving, setSaving] = useState(false);

  const toggleTuneIn = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (saving) return;
      setSaving(true);
      const next = !tunedIn;
      setTunedIn(next);
      try {
        if (next) {
          await apiRequestDelete(`v1/korners/${korner.slug}/tune_out`);
        } else {
          await apiRequestPost(`v1/korners/${korner.slug}/tune_out`, {});
        }
      } catch {
        // Roll back on failure.
        setTunedIn(!next);
      } finally {
        setSaving(false);
      }
    },
    [korner.slug, saving, tunedIn],
  );

  return (
    <Link to={`/hub/${korner.slug}`} className='hub-page__card'>
      <span className='hub-page__card-icon' aria-hidden='true'>
        <Icon />
      </span>
      <div className='hub-page__card-body'>
        <h3 className='hub-page__card-name'>{korner.name}</h3>
        {teaser && <p className='hub-page__card-teaser'>{teaser}</p>}
      </div>
      <button
        type='button'
        onClick={toggleTuneIn}
        className={`hub-page__card-tune ${tunedIn ? 'hub-page__card-tune--in' : 'hub-page__card-tune--out'}`}
        aria-pressed={tunedIn}
        title={tunedIn ? 'Tune out' : 'Tune in'}
      >
        {tunedIn ? (
          <FormattedMessage id='hub.tuned_in' defaultMessage='Tuned in' />
        ) : (
          <FormattedMessage id='hub.tuned_out' defaultMessage='Tune in' />
        )}
      </button>
    </Link>
  );
};

const Hub: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const korners = useAllKorners();

  // Spec §4.7.1: default Hub order is most-tuned-in first. Ties break
  // alphabetically so the grid is stable when many korners share a
  // count (fresh instance before anyone's tuned out of anything).
  const listed = korners
    .filter((k) => k.enforced !== false)
    .sort((a, b) => {
      const diff = (b.tune_in_count ?? 0) - (a.tune_in_count ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });

  return (
    <Column>
      <ColumnHeader title={intl.formatMessage(messages.title)} icon='hub' iconComponent={ExploreIcon} multiColumn={multiColumn} />

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
