/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import HomeIcon from '@/material-icons/400-24px/home-fill.svg?react';
import {
  apiRequestGet,
  apiRequestPut,
  apiRequestPost,
  apiRequestDelete,
} from 'mastodon/api';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { SettingRow } from 'mastodon/features/settings/setting_widgets';
import type { SettingDescriptor } from 'mastodon/features/settings/setting_widgets';
import { useAllKorners } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// Feed settings surface (spec §Feed). Sibling of KornerSettings but for
// the framework-level home feed itself — scope, tune-in list, per-post
// display defaults. Reachable from /home/settings and via a gear on the
// feed column header.

const messages = defineMessages({
  title: { id: 'feed_settings.title', defaultMessage: 'Feed settings' },
  loading: { id: 'feed_settings.loading', defaultMessage: 'Loading…' },
  scopeFriends: {
    id: 'feed_settings.scope.friends',
    defaultMessage: 'Friends',
  },
  scopeFof: {
    id: 'feed_settings.scope.fof',
    defaultMessage: 'Friends of friends',
  },
  scopeKommunity: {
    id: 'feed_settings.scope.kommunity',
    defaultMessage: 'Kommunity',
  },
  scopeFriendsDesc: {
    id: 'feed_settings.scope.friends_desc',
    defaultMessage: 'Only accounts you follow.',
  },
  scopeFofDesc: {
    id: 'feed_settings.scope.fof_desc',
    defaultMessage: 'Your follows, plus who they follow.',
  },
  scopeKommunityDesc: {
    id: 'feed_settings.scope.kommunity_desc',
    defaultMessage: 'Everyone tuned in to your korners.',
  },

  groupBoosts: {
    id: 'feed_settings.group_boosts',
    defaultMessage: 'Group boosts of the same post',
  },
  slowMode: {
    id: 'feed_settings.slow_mode',
    defaultMessage: 'Load new posts manually',
  },
  mediaDisplay: {
    id: 'feed_settings.media_display',
    defaultMessage: 'Media display',
  },
  blurMedia: {
    id: 'feed_settings.blur_media',
    defaultMessage: 'Blur media until you open it',
  },
  expandContentWarnings: {
    id: 'feed_settings.expand_content_warnings',
    defaultMessage: 'Always expand content warnings',
  },
  showTrends: {
    id: 'feed_settings.show_trends',
    defaultMessage: 'Show trends',
  },
});

const DISPLAY_LABELS: Record<string, MessageDescriptor | undefined> = {
  group_boosts: messages.groupBoosts,
  slow_mode: messages.slowMode,
  media_display: messages.mediaDisplay,
  blur_media: messages.blurMedia,
  expand_content_warnings: messages.expandContentWarnings,
  show_trends: messages.showTrends,
};

type Scope = 'friends' | 'friends_of_friends' | 'kommunity';

const SCOPE_OPTIONS: {
  value: Scope;
  label: keyof typeof messages;
  desc: keyof typeof messages;
}[] = [
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

  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onToggle(e.target.checked);
    },
    [onToggle],
  );

  return (
    <label className='feed-settings__korner-row'>
      <span className='feed-settings__korner-glyph' aria-hidden='true'>
        <Icon />
      </span>
      <span className='feed-settings__korner-body'>
        <span className='feed-settings__korner-name'>{korner.name}</span>
        {teaser && (
          <span className='feed-settings__korner-teaser'>{teaser}</span>
        )}
      </span>
      <input
        type='checkbox'
        checked={tunedIn}
        onChange={handleChange}
        aria-label={`Tune ${tunedIn ? 'out of' : 'in to'} ${korner.name}`}
      />
    </label>
  );
};

// Wrapper providing stable per-row toggle callback for the map iteration.
const KornerTuneRowScoped: React.FC<{
  korner: ApiKornerJSON;
  tunedIn: boolean;
  onSet: (slug: string, next: boolean) => void;
}> = ({ korner, tunedIn, onSet }) => {
  const handleToggle = useCallback(
    (next: boolean) => {
      onSet(korner.slug, next);
    },
    [korner.slug, onSet],
  );
  return (
    <KornerTuneRow korner={korner} tunedIn={tunedIn} onToggle={handleToggle} />
  );
};

// Schema-driven display-pref row bound to the feed settings endpoint. The
// name-aware handler is memoised here so the SettingRow onChange isn't an
// inline arrow (react/jsx-no-bind).
const FeedDisplayRow: React.FC<{
  setting: SettingDescriptor;
  value: unknown;
  label?: string;
  onSave: (name: string, value: unknown) => void;
}> = ({ setting, value, label, onSave }) => {
  const handleChange = useCallback(
    (v: unknown) => {
      onSave(setting.name, v);
    },
    [onSave, setting.name],
  );
  return (
    <SettingRow
      setting={{ ...setting, label }}
      value={value}
      onChange={handleChange}
    />
  );
};

export const FeedSettings: React.FC<{ multiColumn?: boolean }> = ({
  multiColumn,
}) => {
  const intl = useIntl();
  const korners = useAllKorners();

  const [scope, setScope] = useState<Scope>('kommunity');
  const [tuneStates, setTuneStates] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [savingScope, setSavingScope] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displaySchema, setDisplaySchema] = useState<SettingDescriptor[]>([]);
  const [displayValues, setDisplayValues] = useState<Record<string, unknown>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<{
          settings_schema: SettingDescriptor[];
          values: Record<string, unknown>;
        }>('v1/settings/feed');
        if (!cancelled) {
          setDisplaySchema(res.settings_schema);
          setDisplayValues(res.values);
        }
      } catch {
        // non-fatal — the Display section just stays empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveDisplay = useCallback(
    (name: string, value: unknown) => {
      const previous = displayValues[name];
      setDisplayValues((v) => ({ ...v, [name]: value }));
      void apiRequestPut<{ values: Record<string, unknown> }>(
        'v1/settings/feed',
        { [name]: value },
      )
        .then((res) => {
          setDisplayValues(res.values);
        })
        .catch(() => {
          setDisplayValues((v) => ({ ...v, [name]: previous }));
        });
    },
    [displayValues],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const scopeRes = await apiRequestGet<{ feed_scope: Scope }>(
          'v1/kronk_settings',
        );
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

  const changeScope = useCallback(
    async (next: Scope) => {
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
    },
    [scope, savingScope],
  );

  const toggleKorner = useCallback(
    async (slug: string, next: boolean) => {
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
    },
    [tuneStates],
  );

  const handleScopeClick = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (e) => {
      const value = e.currentTarget.dataset.scope as Scope | undefined;
      if (value) void changeScope(value);
    },
    [changeScope],
  );

  const handleKornerToggle = useCallback(
    (slug: string, next: boolean) => {
      void toggleKorner(slug, next);
    },
    [toggleKorner],
  );

  const listedKorners = korners
    .filter((k) => k.enforced !== false)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Column>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='feed'
        iconComponent={HomeIcon}
        multiColumn={multiColumn}
        showBackButton
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable feed-settings'>
        <Link to='/home' className='feed-settings__back'>
          <ArrowBackIcon />
          <FormattedMessage
            id='feed_settings.back'
            defaultMessage='Back to feed'
          />
        </Link>

        <header className='feed-settings__header'>
          <span className='feed-settings__glyph' aria-hidden='true'>
            <HomeIcon />
          </span>
          <div>
            <h1 className='feed-settings__title'>
              <FormattedMessage
                id='feed_settings.hero_title'
                defaultMessage='Feed'
              />
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
                data-scope={opt.value}
                onClick={handleScopeClick}
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
            <FormattedMessage
              id='feed_settings.korners'
              defaultMessage='Korners in your feed'
            />
          </h2>
          <p className='feed-settings__section-hint'>
            <FormattedMessage
              id='feed_settings.korners_hint'
              defaultMessage='Every korner you are tuned in to feeds cards into your home column. Untick to tune out.'
            />
          </p>

          {!loaded && listedKorners.length === 0 && (
            <p className='feed-settings__loading'>
              {intl.formatMessage(messages.loading)}
            </p>
          )}

          <div className='feed-settings__korner-list'>
            {listedKorners.map((k) => (
              <KornerTuneRowScoped
                key={k.slug}
                korner={k}
                tunedIn={tuneStates[k.slug] ?? true}
                onSet={handleKornerToggle}
              />
            ))}
          </div>
        </section>

        {displaySchema.length > 0 && (
          <section className='feed-settings__section'>
            <h2 className='feed-settings__section-title'>
              <FormattedMessage
                id='feed_settings.display'
                defaultMessage='Display'
              />
            </h2>
            <p className='feed-settings__section-hint'>
              <FormattedMessage
                id='feed_settings.display_hint'
                defaultMessage='How posts render in your timeline.'
              />
            </p>
            <div className='appearance-settings__fields'>
              {displaySchema.map((setting) => {
                const labelMsg = DISPLAY_LABELS[setting.name];
                return (
                  <FeedDisplayRow
                    key={setting.name}
                    setting={setting}
                    value={displayValues[setting.name]}
                    label={labelMsg ? intl.formatMessage(labelMsg) : undefined}
                    onSave={saveDisplay}
                  />
                );
              })}
            </div>
          </section>
        )}

        <section className='feed-settings__section'>
          <h2 className='feed-settings__section-title'>
            <FormattedMessage
              id='feed_settings.incoming'
              defaultMessage='Silence what reaches you'
            />
          </h2>
          <p className='feed-settings__section-hint'>
            <FormattedMessage
              id='feed_settings.incoming_hint'
              defaultMessage='Filters and blocks control what gets into your feed and mentions.'
            />
          </p>
          <div className='feed-settings__links'>
            <a className='feed-settings__link' href='/filters'>
              <FormattedMessage
                id='feed_settings.filters'
                defaultMessage='Keyword filters'
              />
            </a>
            <a className='feed-settings__link' href='/mutes'>
              <FormattedMessage
                id='feed_settings.mutes'
                defaultMessage='Muted accounts'
              />
            </a>
            <a className='feed-settings__link' href='/blocks'>
              <FormattedMessage
                id='feed_settings.blocks'
                defaultMessage='Blocked accounts'
              />
            </a>
            <a className='feed-settings__link' href='/domain_blocks'>
              <FormattedMessage
                id='feed_settings.domain_blocks'
                defaultMessage='Blocked domains'
              />
            </a>
          </div>
        </section>
      </div>
    </Column>
  );
};
