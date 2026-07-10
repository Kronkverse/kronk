import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import { Helmet } from 'react-helmet';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import ViewAgendaIcon from '@/material-icons/400-24px/view_agenda.svg?react';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { apiRequestGet, apiRequestPut, apiRequestPost, apiRequestDelete } from 'mastodon/api';
import { useAllKorners } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';

// Feed settings surface (spec §Feed). Sibling of KornerSettings but for
// the framework-level home feed itself — scope, tune-in list, per-post
// display defaults. Reachable from /home/settings and via a gear on the
// feed column header.

const messages = defineMessages({
  title: { id: 'feed_settings.title', defaultMessage: 'Feed settings' },
  loading: { id: 'feed_settings.loading', defaultMessage: 'Loading…' },
  scopeFriends: { id: 'feed_settings.scope.friends', defaultMessage: 'Friends' },
  scopeFof: { id: 'feed_settings.scope.fof', defaultMessage: 'Friends of friends' },
  scopeKommunity: { id: 'feed_settings.scope.kommunity', defaultMessage: 'Kommunity' },
  scopeFriendsDesc: { id: 'feed_settings.scope.friends_desc', defaultMessage: 'Only accounts you follow.' },
  scopeFofDesc: { id: 'feed_settings.scope.fof_desc', defaultMessage: 'Your follows, plus who they follow.' },
  scopeKommunityDesc: { id: 'feed_settings.scope.kommunity_desc', defaultMessage: 'Everyone tuned in to your korners.' },
});

type Scope = 'friends' | 'friends_of_friends' | 'kommunity';

const SCOPE_OPTIONS: { value: Scope; label: keyof typeof messages; desc: keyof typeof messages }[] = [
  { value: 'friends', label: 'scopeFriends', desc: 'scopeFriendsDesc' },
  { value: 'friends_of_friends', label: 'scopeFof', desc: 'scopeFofDesc' },
  { value: 'kommunity', label: 'scopeKommunity', desc: 'scopeKommunityDesc' },
];

const KornerTuneRow: React.FC<{
  korner: ApiKornerJSON;
  tunedIn: boolean;
  onToggle: (next: boolean) => void;
}> = ({ korner, tunedIn, onToggle }) => {
  const Icon = useKornerIcon(korner.slug);
  const teaser =
    (korner.hub_teaser?.static as string | undefined) ??
    (korner.launch?.blurb as string | undefined) ??
    '';

  return (
    <label className='feed-settings__korner-row'>
      <span className='feed-settings__korner-glyph' aria-hidden='true'>
        <Icon />
      </span>
      <span className='feed-settings__korner-body'>
        <span className='feed-settings__korner-name'>{korner.name}</span>
        {teaser && <span className='feed-settings__korner-teaser'>{teaser}</span>}
      </span>
      <input
        type='checkbox'
        checked={tunedIn}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={`Tune ${tunedIn ? 'out of' : 'in to'} ${korner.name}`}
      />
    </label>
  );
};

export const FeedSettings: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const korners = useAllKorners();

  const [scope, setScope] = useState<Scope>('kommunity');
  const [tuneStates, setTuneStates] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [savingScope, setSavingScope] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const scopeRes = await apiRequestGet<{ feed_scope: Scope }>('v1/kronk_settings');
        if (!cancelled && scopeRes.feed_scope) setScope(scopeRes.feed_scope);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed the tune-in map from the korner registry which already carries
  // per-viewer tuned_in state on each manifest.
  useEffect(() => {
    if (loaded || korners.length === 0) return;
    const initial: Record<string, boolean> = {};
    for (const k of korners) {
      initial[k.slug] = k.tuned_in !== false;
    }
    setTuneStates(initial);
    setLoaded(true);
  }, [korners, loaded]);

  const changeScope = useCallback(async (next: Scope) => {
    if (savingScope || next === scope) return;
    const previous = scope;
    setScope(next);
    setSavingScope(true);
    try {
      await apiRequestPut('v1/kronk_settings', { feed_scope: next });
    } catch {
      setScope(previous);
    } finally {
      setSavingScope(false);
    }
  }, [scope, savingScope]);

  const toggleKorner = useCallback(async (slug: string, next: boolean) => {
    const previous = tuneStates[slug];
    setTuneStates((prev) => ({ ...prev, [slug]: next }));
    try {
      if (next) {
        await apiRequestDelete(`v1/korners/${slug}/tune_out`);
      } else {
        await apiRequestPost(`v1/korners/${slug}/tune_out`, {});
      }
    } catch {
      setTuneStates((prev) => ({ ...prev, [slug]: previous ?? true }));
    }
  }, [tuneStates]);

  const listedKorners = korners
    .filter((k) => k.enforced !== false)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Column>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='feed'
        iconComponent={ViewAgendaIcon}
        multiColumn={multiColumn}
        showBackButton
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable feed-settings'>
        <Link to='/home' className='feed-settings__back'>
          <ArrowBackIcon />
          <FormattedMessage id='feed_settings.back' defaultMessage='Back to feed' />
        </Link>

        <header className='feed-settings__header'>
          <span className='feed-settings__glyph' aria-hidden='true'>
            <ViewAgendaIcon />
          </span>
          <div>
            <h1 className='feed-settings__title'>
              <FormattedMessage id='feed_settings.hero_title' defaultMessage='Feed' />
            </h1>
            <p className='feed-settings__subtitle'>
              <FormattedMessage
                id='feed_settings.hero_intro'
                defaultMessage='Choose what fills your home column. Scope decides who; tune-ins decide what.'
              />
            </p>
          </div>
        </header>

        {error && <p className='feed-settings__error'>{error}</p>}

        <section className='feed-settings__section'>
          <h2 className='feed-settings__section-title'>
            <FormattedMessage id='feed_settings.scope' defaultMessage='Scope' />
          </h2>
          <div className='feed-settings__scope-options'>
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type='button'
                onClick={() => void changeScope(opt.value)}
                className={`feed-settings__scope-card ${scope === opt.value ? 'feed-settings__scope-card--active' : ''}`}
                aria-pressed={scope === opt.value}
              >
                <span className='feed-settings__scope-title'>
                  {intl.formatMessage(messages[opt.label])}
                </span>
                <span className='feed-settings__scope-desc'>
                  {intl.formatMessage(messages[opt.desc])}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className='feed-settings__section'>
          <h2 className='feed-settings__section-title'>
            <FormattedMessage id='feed_settings.korners' defaultMessage='Korners in your feed' />
          </h2>
          <p className='feed-settings__section-hint'>
            <FormattedMessage
              id='feed_settings.korners_hint'
              defaultMessage='Every korner you are tuned in to feeds cards into your home column. Untick to tune out.'
            />
          </p>

          {!loaded && listedKorners.length === 0 && (
            <p className='feed-settings__loading'>{intl.formatMessage(messages.loading)}</p>
          )}

          <div className='feed-settings__korner-list'>
            {listedKorners.map((k) => (
              <KornerTuneRow
                key={k.slug}
                korner={k}
                tunedIn={tuneStates[k.slug] ?? true}
                onToggle={(next) => void toggleKorner(k.slug, next)}
              />
            ))}
          </div>
        </section>
      </div>
    </Column>
  );
};

export default FeedSettings;
