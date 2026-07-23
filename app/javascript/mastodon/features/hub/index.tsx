import { useCallback, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import { apiRequestPost, apiRequestDelete } from 'mastodon/api';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { Stage } from 'mastodon/components/stage';
import { useAllKorners } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

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

  // Coming-soon korners: manifest is declared (`enforced: false`) but
  // the space isn't ready to be tuned into. Card still renders so the
  // Hub reads as "here's every space Kronk grows toward"; tune-in +
  // settings affordances retire until the korner ships.
  const soon = korner.enforced === false;

  const toggleTuneInInner = useCallback(
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

  const toggleTuneIn = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      void toggleTuneInInner(e);
    },
    [toggleTuneInInner],
  );

  const stopClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className={`hub-page__card ${soon ? 'hub-page__card--soon' : ''}`}>
      {soon && (
        <span className='hub-page__card-soon-badge'>
          <FormattedMessage id='hub.soon' defaultMessage='Coming soon' />
        </span>
      )}
      {/* Open-korner surface fills the top of the card without wrapping
          the whole card; nesting a <Link> inside another <Link> collapses
          the inner one, which was making the settings gear silently
          route to the parent korner. */}
      <Link
        to={`/hub/${korner.slug}`}
        className='hub-page__card-open'
        aria-label={`Open ${korner.name}`}
      >
        <span className='hub-page__card-icon' aria-hidden='true'>
          <Icon />
        </span>
        <div className='hub-page__card-body'>
          <h3 className='hub-page__card-name'>{korner.name}</h3>
          {teaser && <p className='hub-page__card-teaser'>{teaser}</p>}
        </div>
      </Link>
      {!soon && (
        <div className='hub-page__card-footer'>
          <Link
            to={`/hub/${korner.slug}/settings`}
            className='hub-page__card-settings-link'
            onClick={stopClick}
            aria-label={`Settings for ${korner.name}`}
            title={`${korner.name} settings`}
          >
            <SettingsIcon />
          </Link>
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
        </div>
      )}
    </div>
  );
};

const Hub: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const korners = useAllKorners();

  // Spec §4.7.1: default Hub order is most-tuned-in first. Ties break
  // alphabetically so the grid is stable when many korners share a
  // count (fresh instance before anyone's tuned out of anything).
  // Coming-soon (enforced: false) korners sort after live ones so the
  // Hub reads as "here's what's ready, and here's what's coming."
  const sorted = korners.slice().sort((a, b) => {
    const diff = (b.tune_in_count ?? 0) - (a.tune_in_count ?? 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
  const live = sorted.filter((k) => k.enforced !== false);
  const soon = sorted.filter((k) => k.enforced === false);

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='hub-page'>
        <header className='hub-page__intro'>
          <FormattedMessage
            id='hub.hero_intro'
            defaultMessage='Every korner on this instance. Drop into whichever fits what you feel like doing.'
          />
        </header>

        {live.length === 0 && soon.length === 0 && (
          <p className='hub-page__empty'>
            <FormattedMessage
              id='hub.empty'
              defaultMessage='No korners are loaded yet. This usually means the manifest registry is still fetching.'
            />
          </p>
        )}

        {live.length > 0 && (
          <div className='hub-page__grid'>
            {live.map((k) => (
              <KornerCard key={k.slug} korner={k} />
            ))}
          </div>
        )}

        {soon.length > 0 && (
          <>
            <h2 className='hub-page__section-label'>
              <FormattedMessage
                id='hub.soon_section'
                defaultMessage='Coming to Kronk'
              />
            </h2>
            <div className='hub-page__grid hub-page__grid--soon'>
              {soon.map((k) => (
                <KornerCard key={k.slug} korner={k} />
              ))}
            </div>
          </>
        )}
      </div>
    </Stage>
  );
};

export { Hub };
