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

import {
  apiRequestGet,
  apiRequestPut,
  apiRequestPost,
  apiRequestDelete,
} from 'mastodon/api';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { AllSettingsFooter } from 'mastodon/components/all_settings_footer';
import { Stage } from 'mastodon/components/stage';
import { SettingRow } from 'mastodon/features/settings/setting_widgets';
import type { SettingDescriptor } from 'mastodon/features/settings/setting_widgets';
import { SettingsSpaceHeader } from 'mastodon/features/settings/space_header';
import { useAllKorners } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// Feed settings surface (spec §Feed). Sibling of KornerSettings but for
// the framework-level home feed itself — scope, tune-in list, per-post
// display defaults. Mounted at /home/settings (the feed limb owns its
// own settings — see kronk_nodes.yaml `settings.feed`) and reached via
// the Ж menu / a gear on the feed column header. Chrome adheres to
// Korner Standard L12: Stage + .space-header, with AutoSettingsBadge
// providing back-nav in the Frame's SpaceNav slot.

const messages = defineMessages({
  title: { id: 'feed_settings.title', defaultMessage: 'Feed settings' },
  loading: { id: 'feed_settings.loading', defaultMessage: 'Loading…' },
  scopeMates: {
    id: 'feed_settings.scope.mates',
    defaultMessage: 'Mates',
  },
  scopeOrbit: {
    id: 'feed_settings.scope.orbit',
    defaultMessage: 'Orbit',
  },
  scopeKommunity: {
    id: 'feed_settings.scope.kommunity',
    defaultMessage: 'Kommunity',
  },
  scopeMatesDesc: {
    id: 'feed_settings.scope.mates_desc',
    defaultMessage: 'Only your Mates.',
  },
  scopeOrbitDesc: {
    id: 'feed_settings.scope.orbit_desc',
    defaultMessage: 'Your Mates plus their Mates.',
  },
  scopeKommunityDesc: {
    id: 'feed_settings.scope.kommunity_desc',
    defaultMessage: 'Everyone on this Kronk.',
  },

  groupBoosts: {
    id: 'feed_settings.group_boosts',
    defaultMessage: 'Group boosts of the same post',
  },
  mediaDisplay: {
    id: 'feed_settings.media_display',
    defaultMessage: 'Media display',
  },
  momentsStripOnHome: {
    id: 'feed_settings.moments_strip_on_home',
    defaultMessage: 'Show the Moments strip at the top of my home feed',
  },

  languagesFilter: {
    id: 'feed_settings.languages_filter',
    defaultMessage: 'Filter',
  },
  languagesFilterAria: {
    id: 'feed_settings.languages_filter_aria',
    defaultMessage: 'Filter languages',
  },
});

// Backend `Api::V1::Settings::FeedController#FIELDS` decides which
// keys ship in `settings_schema`; the labels here are a lookup for
// prettier copy. Anything else the backend adds falls through to the
// widget's built-in humanised name.
const DISPLAY_LABELS: Record<string, MessageDescriptor | undefined> = {
  group_boosts: messages.groupBoosts,
  media_display: messages.mediaDisplay,
  moments_strip_on_home: messages.momentsStripOnHome,
};

type Scope = 'mates' | 'orbit' | 'kommunity';

const SCOPE_OPTIONS: {
  value: Scope;
  label: keyof typeof messages;
  desc: keyof typeof messages;
}[] = [
  { value: 'mates', label: 'scopeMates', desc: 'scopeMatesDesc' },
  { value: 'orbit', label: 'scopeOrbit', desc: 'scopeOrbitDesc' },
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

export const FeedSettings: React.FC = () => {
  const intl = useIntl();
  const korners = useAllKorners();

  const [scope, setScope] = useState<Scope>('orbit');
  const [tuneStates, setTuneStates] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [savingScope, setSavingScope] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displaySchema, setDisplaySchema] = useState<SettingDescriptor[]>([]);
  const [displayValues, setDisplayValues] = useState<Record<string, unknown>>(
    {},
  );
  const [languageOptions, setLanguageOptions] = useState<
    { value: string; native_name: string }[]
  >([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [languageFilter, setLanguageFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<{
          settings_schema: SettingDescriptor[];
          values: Record<string, unknown>;
          chosen_languages: {
            selected: string[];
            options: { value: string; native_name: string }[];
          };
        }>('v1/settings/feed');
        if (!cancelled) {
          setDisplaySchema(res.settings_schema);
          setDisplayValues(res.values);
          setLanguageOptions(res.chosen_languages.options);
          setSelectedLanguages(res.chosen_languages.selected);
        }
      } catch {
        // non-fatal — the Display + Languages sections just stay empty
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

  const saveLanguages = useCallback(
    (next: string[]) => {
      const previous = selectedLanguages;
      setSelectedLanguages(next);
      void apiRequestPut<{
        chosen_languages: { selected: string[] };
      }>('v1/settings/feed', { chosen_languages: next })
        .then((res) => {
          setSelectedLanguages(res.chosen_languages.selected);
        })
        .catch(() => {
          setSelectedLanguages(previous);
        });
    },
    [selectedLanguages],
  );

  const toggleLanguage = useCallback(
    (code: string) => {
      const set = new Set(selectedLanguages);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      saveLanguages(Array.from(set));
    },
    [selectedLanguages, saveLanguages],
  );

  const clearLanguages = useCallback(() => {
    saveLanguages([]);
  }, [saveLanguages]);

  const handleLanguageFilter = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setLanguageFilter(e.currentTarget.value);
  }, []);

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
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable feed-settings'>
        <SettingsSpaceHeader
          title={
            <FormattedMessage
              id='feed_settings.hero_title'
              defaultMessage='Feed'
            />
          }
          tagline={
            <FormattedMessage
              id='feed_settings.hero_intro'
              defaultMessage='Choose what fills your home column. Scope decides who; tune-ins decide what.'
            />
          }
        />

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

        {languageOptions.length > 0 && (
          <LanguagesSection
            options={languageOptions}
            selected={selectedLanguages}
            filter={languageFilter}
            onFilterChange={handleLanguageFilter}
            onToggle={toggleLanguage}
            onClear={clearLanguages}
          />
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
            {/* Mutes + blocks moved to the native Privacy page's
                ListManager (see PrivacySettings § Manage lists) —
                these links jump there instead of the old Rails
                `/mutes` / `/blocks` pages (Tal 2026-09-13 audit).
                Uses the SPA router so the transition stays inside
                Kronk chrome. */}
            <Link className='feed-settings__link' to='/settings/privacy'>
              <FormattedMessage
                id='feed_settings.mutes'
                defaultMessage='Muted accounts'
              />
            </Link>
            <Link className='feed-settings__link' to='/settings/privacy'>
              <FormattedMessage
                id='feed_settings.blocks'
                defaultMessage='Blocked accounts'
              />
            </Link>
            {/* Domain blocks still on Rails until Privacy's
                ListManager grows a domain-block adapter. */}
            <a className='feed-settings__link' href='/domain_blocks'>
              <FormattedMessage
                id='feed_settings.domain_blocks'
                defaultMessage='Blocked domains'
              />
            </a>
          </div>
        </section>

        <AllSettingsFooter />
      </div>
    </Stage>
  );
};

// Public-timeline language filter. Reads/writes User#chosen_languages
// via /api/v1/settings/feed. Deliberately not built as a proper
// combobox: 150 languages fit in a scrollable native list, a text
// filter (case-insensitive, matches native name or code) narrows
// quickly. "Empty selection" means no filter \u2014 every language
// passes, matching Mastodon's classic behaviour.
const LanguagesSection: React.FC<{
  options: { value: string; native_name: string }[];
  selected: string[];
  filter: string;
  onFilterChange: React.ChangeEventHandler<HTMLInputElement>;
  onToggle: (code: string) => void;
  onClear: () => void;
}> = ({ options, selected, filter, onFilterChange, onToggle, onClear }) => {
  const intl = useIntl();
  const selectedSet = new Set(selected);
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          o.native_name.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q),
      )
    : options;

  return (
    <section className='feed-settings__section'>
      <h2 className='feed-settings__section-title'>
        <FormattedMessage
          id='feed_settings.languages_title'
          defaultMessage='Languages in public timelines'
        />
      </h2>
      <p className='feed-settings__section-hint'>
        <FormattedMessage
          id='feed_settings.languages_hint'
          defaultMessage='Which languages you want to see in the public timelines. Leave empty to see them all.'
        />
      </p>
      <div className='feed-settings__lang-toolbar'>
        <input
          type='search'
          className='feed-settings__lang-filter'
          value={filter}
          onChange={onFilterChange}
          placeholder={intl.formatMessage(messages.languagesFilter)}
          aria-label={intl.formatMessage(messages.languagesFilterAria)}
        />
        <span className='feed-settings__lang-count'>
          <FormattedMessage
            id='feed_settings.languages_count'
            defaultMessage='{selected} selected of {total}'
            values={{ selected: selected.length, total: options.length }}
          />
        </span>
        {selected.length > 0 && (
          <button
            type='button'
            className='feed-settings__lang-clear'
            onClick={onClear}
          >
            <FormattedMessage
              id='feed_settings.languages_clear'
              defaultMessage='Clear'
            />
          </button>
        )}
      </div>
      <ul className='feed-settings__lang-list'>
        {filtered.map((opt) => (
          <LanguageRow
            key={opt.value}
            option={opt}
            checked={selectedSet.has(opt.value)}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </section>
  );
};

const LanguageRow: React.FC<{
  option: { value: string; native_name: string };
  checked: boolean;
  onToggle: (code: string) => void;
}> = ({ option, checked, onToggle }) => {
  const handleChange = useCallback(() => {
    onToggle(option.value);
  }, [onToggle, option.value]);
  return (
    <li className='feed-settings__lang-row'>
      <label className='feed-settings__lang-label'>
        <input type='checkbox' checked={checked} onChange={handleChange} />
        <span className='feed-settings__lang-name'>{option.native_name}</span>
        <span className='feed-settings__lang-code'>{option.value}</span>
      </label>
    </li>
  );
};
