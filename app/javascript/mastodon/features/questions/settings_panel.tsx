import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import api from 'mastodon/api';
import type { KuestionVisibilityScope } from 'mastodon/api_types/kuestions';

import { VisibilityDial } from './visibility_dial';

// Kuestions Answer scope + the manifest setting both use the platform
// reach ladder (docs/kronk_feed_and_reach.md §2) after slice 4 of the
// visibility standardisation. The migration walks stored user_settings
// off the legacy Mastodon triple (public/unlisted/followers), but keep
// a defensive read map here for any settings that slip through.
const LEGACY_MANIFEST_TO_SCOPE: Record<string, KuestionVisibilityScope> = {
  unlisted: 'public',
  followers: 'mates',
};

const KNOWN_SCOPES: readonly KuestionVisibilityScope[] = [
  'public',
  'orbit',
  'mates',
  'self_only',
];

const messages = defineMessages({
  header: {
    id: 'kuestions.settings.subtitle',
    defaultMessage: 'How much of the Q&A reaches you.',
  },
  dailyPromptTitle: {
    id: 'kuestions.settings.daily_prompt_title',
    defaultMessage: 'Daily prompt in my post box',
  },
  dailyPromptNote: {
    id: 'kuestions.settings.daily_prompt_note',
    defaultMessage:
      'Kronk sets one prompt a day — the same for everyone. It sits faint in your composer as a starting point; your reply is a normal post.',
  },
  hideAnsweredTitle: {
    id: 'kuestions.settings.hide_answered_title',
    defaultMessage: "Hide kuestions I've answered",
  },
  hideAnsweredNote: {
    id: 'kuestions.settings.hide_answered_note',
    defaultMessage: "Keeps the deck to what's still locked.",
  },
  confirmTitle: {
    id: 'kuestions.settings.confirm_title',
    defaultMessage: 'Confirm before unlocking',
  },
  confirmNote: {
    id: 'kuestions.settings.confirm_note',
    defaultMessage:
      'Ask once more before your answer posts and the thread opens.',
  },
  scopeTitle: {
    id: 'kuestions.settings.scope_title',
    defaultMessage: 'Default answer visibility',
  },
  scopeNote: {
    id: 'kuestions.settings.scope_note',
    defaultMessage:
      'Applied to every free-text answer unless you change it on the card.',
  },
  loading: {
    id: 'kuestions.settings.loading',
    defaultMessage: 'Loading settings…',
  },
});

interface SettingsRow {
  name: string;
  value: unknown;
  kind: string;
  default?: unknown;
}

interface SettingsPayload {
  settings: SettingsRow[];
}

// Minimal Kuestions settings surface backed by the generic korner
// settings API (see korner_settings/index.tsx for the full-featured
// version). Kept bespoke because the prototype has a specific look —
// dial + toggles + prompt-in-post-box preview.
export const SettingsPanel: React.FC = () => {
  const intl = useIntl();
  const [values, setValues] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    const res = await api().get<SettingsPayload>(
      '/api/v1/korners/kuestions/settings',
    );
    const map: Record<string, unknown> = {};
    for (const r of res.data.settings) {
      map[r.name] = r.value !== undefined ? r.value : r.default;
    }
    setValues(map);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback((name: string, value: unknown) => {
    setValues((prev) => (prev ? { ...prev, [name]: value } : prev));
    void (async () => {
      try {
        await api().patch(
          `/api/v1/korners/kuestions/settings/${encodeURIComponent(name)}`,
          { value },
        );
      } catch {
        // Optimistic revert on failure would be nice; keeping simple
        // for the MVP — a reload restores the server truth.
      }
    })();
  }, []);

  const handleDailyPrompt = useCallback(
    (v: boolean) => {
      patch('daily_prompt_in_post_box', v);
    },
    [patch],
  );
  const handleHideAnswered = useCallback(
    (v: boolean) => {
      patch('hide_answered_questions', v);
    },
    [patch],
  );
  const handleConfirm = useCallback(
    (v: boolean) => {
      patch('unlock_confirmation', v);
    },
    [patch],
  );
  const handleScope = useCallback(
    (next: KuestionVisibilityScope) => {
      patch('default_answer_visibility', next);
    },
    [patch],
  );

  if (!values) {
    return (
      <section className='kuestions-panel'>
        <p className='space-subtitle'>{intl.formatMessage(messages.loading)}</p>
      </section>
    );
  }

  const rawScope = values.default_answer_visibility;
  const scopeString = typeof rawScope === 'string' ? rawScope : '';
  const scope: KuestionVisibilityScope = KNOWN_SCOPES.includes(
    scopeString as KuestionVisibilityScope,
  )
    ? (scopeString as KuestionVisibilityScope)
    : (LEGACY_MANIFEST_TO_SCOPE[scopeString] ?? 'mates');
  const hideAnswered = Boolean(values.hide_answered_questions ?? false);
  const confirm = Boolean(values.unlock_confirmation ?? true);
  const dailyPrompt = Boolean(values.daily_prompt_in_post_box ?? true);

  return (
    <section className='kuestions-panel'>
      <p className='space-subtitle'>{intl.formatMessage(messages.header)}</p>

      <div className='kuestions-settings'>
        <ToggleRow
          value={dailyPrompt}
          title={intl.formatMessage(messages.dailyPromptTitle)}
          note={intl.formatMessage(messages.dailyPromptNote)}
          onChange={handleDailyPrompt}
        />
        <ToggleRow
          value={hideAnswered}
          title={intl.formatMessage(messages.hideAnsweredTitle)}
          note={intl.formatMessage(messages.hideAnsweredNote)}
          onChange={handleHideAnswered}
        />
        <ToggleRow
          value={confirm}
          title={intl.formatMessage(messages.confirmTitle)}
          note={intl.formatMessage(messages.confirmNote)}
          onChange={handleConfirm}
        />
        <ScopeRow value={scope} onChange={handleScope} />
      </div>

      <div className='kuestions-settings__postbox'>
        <div className='kuestions-settings__postbox-chip'>
          <b>Ƙ</b>{' '}
          <FormattedMessage
            id='kuestions.settings.postbox_chip'
            defaultMessage="Today's prompt · from Kronk"
          />
        </div>
        <div className='kuestions-settings__postbox-ph'>
          <FormattedMessage
            id='kuestions.settings.postbox_placeholder_preview'
            defaultMessage="What's one thing Kronk should never do?"
          />
        </div>
        <p className='kuestions-settings__postbox-note'>
          <FormattedMessage
            id='kuestions.settings.postbox_note'
            defaultMessage="This is how the prompt sits in Murmur's composer."
          />
        </p>
      </div>
    </section>
  );
};

interface ToggleRowProps {
  value: boolean;
  title: string;
  note: string;
  onChange: (next: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  value,
  title,
  note,
  onChange,
}) => {
  const handleClick = useCallback(() => {
    onChange(!value);
  }, [onChange, value]);

  return (
    <div className='kuestions-settings__row'>
      <div className='kuestions-settings__row-body'>
        <b>{title}</b>
        <span>{note}</span>
      </div>
      <button
        type='button'
        role='switch'
        aria-checked={value}
        className={`kuestions-settings__switch ${value ? 'kuestions-settings__switch--on' : ''}`}
        onClick={handleClick}
      >
        <span className='kuestions-settings__switch-knob' />
      </button>
    </div>
  );
};

interface ScopeRowProps {
  value: KuestionVisibilityScope;
  onChange: (next: KuestionVisibilityScope) => void;
}

// Inline visibility dial — reuses the shape from the answer sheet
// but rendered wider + without the note (we have our own description
// in the row body).
const ScopeRow: React.FC<ScopeRowProps> = ({ value, onChange }) => {
  const intl = useIntl();
  return (
    <div className='kuestions-settings__row kuestions-settings__row--stack'>
      <div className='kuestions-settings__row-body'>
        <b>{intl.formatMessage(messages.scopeTitle)}</b>
        <span>{intl.formatMessage(messages.scopeNote)}</span>
      </div>
      {/* Import intentionally deferred — we reuse the VisibilityDial
          component from the answer sheet so the two surfaces don't
          drift. */}
      <ScopeDial value={value} onChange={onChange} />
    </div>
  );
};

const ScopeDial: React.FC<{
  value: KuestionVisibilityScope;
  onChange: (next: KuestionVisibilityScope) => void;
}> = ({ value, onChange }) => (
  <VisibilityDial value={value} onChange={onChange} withNote={false} />
);
