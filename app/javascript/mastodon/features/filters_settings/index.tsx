/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import {
  SettingsPage,
  SettingsSection,
} from 'mastodon/features/settings/components';
import type { SaveStatus } from 'mastodon/features/settings/components';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

// Native keyword-filters CRUD, replacing the /filters Rails page
// (Tal 2026-09-13 settings audit). One "New filter" section and one
// "Your filters" list; each row expands for edit.
//
// Wraps /api/v2/filters — the v2 endpoint takes `keywords_attributes`
// as nested params so create + edit can round-trip in one request.

interface Keyword {
  id?: string;
  keyword: string;
  whole_word: boolean;
  _destroy?: boolean;
}

interface Filter {
  id: string;
  title: string;
  context: string[];
  filter_action: 'warn' | 'hide';
  expires_at: string | null;
  keywords: {
    id: string;
    keyword: string;
    whole_word: boolean;
  }[];
}

const ALL_CONTEXTS = ['home', 'notifications', 'public', 'thread', 'account'];

const messages = defineMessages({
  title: { id: 'filters_settings.title', defaultMessage: 'Keyword filters' },
  intro: {
    id: 'filters_settings.intro',
    defaultMessage:
      'Hide or warn on posts containing specific words. Filters apply to your feed, replies, and notifications.',
  },

  sectionNewTitle: {
    id: 'filters_settings.new_title',
    defaultMessage: 'New filter',
  },
  sectionListTitle: {
    id: 'filters_settings.list_title',
    defaultMessage: 'Your filters',
  },

  filterTitle: {
    id: 'filters_settings.filter_title',
    defaultMessage: 'Name',
  },
  filterTitlePlaceholder: {
    id: 'filters_settings.filter_title_placeholder',
    defaultMessage: 'e.g. Spoilers, work talk, election chatter',
  },
  keywords: {
    id: 'filters_settings.keywords',
    defaultMessage: 'Keywords',
  },
  keywordsHint: {
    id: 'filters_settings.keywords_hint',
    defaultMessage:
      'Comma-separated. A post matching any of these is filtered.',
  },
  wholeWord: {
    id: 'filters_settings.whole_word',
    defaultMessage: 'Whole word only',
  },
  wholeWordHint: {
    id: 'filters_settings.whole_word_hint',
    defaultMessage: '"cat" matches "cat" but not "catch". Off = substring.',
  },
  action: { id: 'filters_settings.action', defaultMessage: 'When it matches' },
  actionHide: {
    id: 'filters_settings.action_hide',
    defaultMessage: 'Hide the post',
  },
  actionWarn: {
    id: 'filters_settings.action_warn',
    defaultMessage: 'Show a warning',
  },
  contexts: {
    id: 'filters_settings.contexts',
    defaultMessage: 'Where',
  },
  contextsHint: {
    id: 'filters_settings.contexts_hint',
    defaultMessage: 'Which surfaces the filter applies to.',
  },
  contextHome: {
    id: 'filters_settings.context.home',
    defaultMessage: 'Home',
  },
  contextNotifications: {
    id: 'filters_settings.context.notifications',
    defaultMessage: 'Nudges',
  },
  contextPublic: {
    id: 'filters_settings.context.public',
    defaultMessage: 'Kronkverse',
  },
  contextThread: {
    id: 'filters_settings.context.thread',
    defaultMessage: 'Threads',
  },
  contextAccount: {
    id: 'filters_settings.context.account',
    defaultMessage: 'Profiles',
  },

  save: { id: 'filters_settings.save', defaultMessage: 'Save filter' },
  cancel: { id: 'filters_settings.cancel', defaultMessage: 'Cancel' },
  edit: { id: 'filters_settings.edit', defaultMessage: 'Edit' },
  delete: { id: 'filters_settings.delete', defaultMessage: 'Delete' },
  saveEdit: { id: 'filters_settings.save_edit', defaultMessage: 'Save' },
  deleteTitle: {
    id: 'filters_settings.delete_title',
    defaultMessage: 'Delete this filter?',
  },
  deleteMessage: {
    id: 'filters_settings.delete_message',
    defaultMessage:
      'The filter and all its keywords will be removed. Posts matching them will show again.',
  },

  empty: {
    id: 'filters_settings.empty',
    defaultMessage: 'No filters yet. Add one above.',
  },
  loadError: {
    id: 'filters_settings.load_error',
    defaultMessage: 'Couldn’t load your filters.',
  },
  errNeedsTitle: {
    id: 'filters_settings.err_needs_title',
    defaultMessage: 'Give the filter a name first.',
  },
  errNeedsKeyword: {
    id: 'filters_settings.err_needs_keyword',
    defaultMessage: 'Add at least one keyword.',
  },
  errNeedsContext: {
    id: 'filters_settings.err_needs_context',
    defaultMessage: 'Pick at least one place for the filter to apply.',
  },
});

const CONTEXT_LABELS = {
  home: messages.contextHome,
  notifications: messages.contextNotifications,
  public: messages.contextPublic,
  thread: messages.contextThread,
  account: messages.contextAccount,
} as const;

function parseKeywords(
  raw: string,
): { keyword: string; whole_word: boolean }[] {
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .map((keyword) => ({ keyword, whole_word: false }));
}

function keywordsToString(keywords: Filter['keywords']): string {
  return keywords.map((k) => k.keyword).join(', ');
}

function summariseContexts(contexts: string[]): string {
  return contexts
    .map((c) => {
      const msg = CONTEXT_LABELS[c as keyof typeof CONTEXT_LABELS];
      return msg?.defaultMessage ?? c;
    })
    .join(' · ');
}

// ─── New-filter form ────────────────────────────────────────────────
interface NewFilterFormProps {
  onCreated: (filter: Filter) => void;
}

const DEFAULT_CONTEXTS = ['home', 'notifications', 'public'];

const NewFilterForm: React.FC<NewFilterFormProps> = ({ onCreated }) => {
  const intl = useIntl();
  const [title, setTitle] = useState('');
  const [keywords, setKeywords] = useState('');
  const [wholeWord, setWholeWord] = useState(false);
  const [contexts, setContexts] = useState<string[]>(DEFAULT_CONTEXTS);
  const [action, setAction] = useState<'warn' | 'hide'>('warn');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );
  const onKeywordsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setKeywords(e.target.value);
    },
    [],
  );
  const onWholeWordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setWholeWord(e.target.checked);
    },
    [],
  );
  const onContextToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const c = e.target.value;
      setContexts((prev) =>
        e.target.checked ? [...prev, c] : prev.filter((x) => x !== c),
      );
    },
    [],
  );
  const onActionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAction(e.target.value === 'hide' ? 'hide' : 'warn');
    },
    [],
  );

  const submit = useCallback(async () => {
    setErrorMsg(null);
    if (title.trim() === '') {
      setErrorMsg(intl.formatMessage(messages.errNeedsTitle));
      setStatus('error');
      return;
    }
    const parsed = parseKeywords(keywords).map((k) => ({
      ...k,
      whole_word: wholeWord,
    }));
    if (parsed.length === 0) {
      setErrorMsg(intl.formatMessage(messages.errNeedsKeyword));
      setStatus('error');
      return;
    }
    if (contexts.length === 0) {
      setErrorMsg(intl.formatMessage(messages.errNeedsContext));
      setStatus('error');
      return;
    }

    setStatus('saving');
    try {
      const filter = await apiRequestPost<Filter>('v2/filters', {
        title: title.trim(),
        context: contexts,
        filter_action: action,
        keywords_attributes: parsed,
      });
      onCreated(filter);
      setTitle('');
      setKeywords('');
      setWholeWord(false);
      setContexts(DEFAULT_CONTEXTS);
      setAction('warn');
      setStatus('saved');
    } catch {
      setStatus('error');
      setErrorMsg(intl.formatMessage(messages.errNeedsKeyword));
    }
  }, [intl, title, keywords, wholeWord, contexts, action, onCreated]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void submit();
    },
    [submit],
  );

  return (
    <form className='filters-settings__form' onSubmit={handleSubmit}>
      <div className='settings-page__row settings-page__row--stack'>
        <div className='settings-page__row-body'>
          <label
            className='settings-page__row-label'
            htmlFor='filter-new-title'
          >
            {intl.formatMessage(messages.filterTitle)}
          </label>
        </div>
        <input
          id='filter-new-title'
          type='text'
          className='filters-settings__input'
          value={title}
          onChange={onTitleChange}
          placeholder={intl.formatMessage(messages.filterTitlePlaceholder)}
        />
      </div>

      <div className='settings-page__row settings-page__row--stack'>
        <div className='settings-page__row-body'>
          <label
            className='settings-page__row-label'
            htmlFor='filter-new-keywords'
          >
            {intl.formatMessage(messages.keywords)}
          </label>
          <div className='settings-page__row-desc'>
            {intl.formatMessage(messages.keywordsHint)}
          </div>
        </div>
        <input
          id='filter-new-keywords'
          type='text'
          className='filters-settings__input'
          value={keywords}
          onChange={onKeywordsChange}
        />
      </div>

      <div className='settings-page__row'>
        <div className='settings-page__row-body'>
          <div className='settings-page__row-label'>
            {intl.formatMessage(messages.wholeWord)}
          </div>
          <div className='settings-page__row-desc'>
            {intl.formatMessage(messages.wholeWordHint)}
          </div>
        </div>
        <div className='settings-page__row-widget'>
          <input
            type='checkbox'
            checked={wholeWord}
            onChange={onWholeWordChange}
            aria-label={intl.formatMessage(messages.wholeWord)}
          />
        </div>
      </div>

      <div className='settings-page__row settings-page__row--stack'>
        <div className='settings-page__row-body'>
          <div className='settings-page__row-label'>
            {intl.formatMessage(messages.contexts)}
          </div>
          <div className='settings-page__row-desc'>
            {intl.formatMessage(messages.contextsHint)}
          </div>
        </div>
        <div className='filters-settings__contexts'>
          {ALL_CONTEXTS.map((c) => (
            <label key={c} className='filters-settings__chip'>
              <input
                type='checkbox'
                value={c}
                checked={contexts.includes(c)}
                onChange={onContextToggle}
              />
              {intl.formatMessage(
                CONTEXT_LABELS[c as keyof typeof CONTEXT_LABELS],
              )}
            </label>
          ))}
        </div>
      </div>

      <div className='settings-page__row settings-page__row--stack'>
        <div className='settings-page__row-body'>
          <div className='settings-page__row-label'>
            {intl.formatMessage(messages.action)}
          </div>
        </div>
        <div className='filters-settings__actions'>
          <label className='filters-settings__chip'>
            <input
              type='radio'
              name='new-filter-action'
              value='warn'
              checked={action === 'warn'}
              onChange={onActionChange}
            />
            {intl.formatMessage(messages.actionWarn)}
          </label>
          <label className='filters-settings__chip'>
            <input
              type='radio'
              name='new-filter-action'
              value='hide'
              checked={action === 'hide'}
              onChange={onActionChange}
            />
            {intl.formatMessage(messages.actionHide)}
          </label>
        </div>
      </div>

      <div className='filters-settings__submit-row'>
        {errorMsg && (
          <span className='filters-settings__error'>{errorMsg}</span>
        )}
        <button
          type='submit'
          className='filters-settings__submit'
          disabled={status === 'saving'}
        >
          {intl.formatMessage(messages.save)}
        </button>
      </div>
    </form>
  );
};

// ─── Existing filter row ────────────────────────────────────────────
interface FilterRowProps {
  filter: Filter;
  onChanged: (filter: Filter) => void;
  onDeleted: (id: string) => void;
}

const FilterRow: React.FC<FilterRowProps> = ({
  filter,
  onChanged,
  onDeleted,
}) => {
  const intl = useIntl();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(filter.title);
  const [keywords, setKeywords] = useState(keywordsToString(filter.keywords));
  const [contexts, setContexts] = useState<string[]>(filter.context);
  const [action, setAction] = useState<'warn' | 'hide'>(filter.filter_action);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, confirm] = useConfirmDialog();

  const startEdit = useCallback(() => {
    setTitle(filter.title);
    setKeywords(keywordsToString(filter.keywords));
    setContexts(filter.context);
    setAction(filter.filter_action);
    setEditing(true);
  }, [filter]);
  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const onTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );
  const onKeywordsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setKeywords(e.target.value);
    },
    [],
  );
  const onContextToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const c = e.target.value;
      setContexts((prev) =>
        e.target.checked ? [...prev, c] : prev.filter((x) => x !== c),
      );
    },
    [],
  );
  const onActionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAction(e.target.value === 'hide' ? 'hide' : 'warn');
    },
    [],
  );

  const saveEdit = useCallback(async () => {
    setSaving(true);
    // Build keywords_attributes: for each existing keyword we still
    // want, keep the id; for anything missing from the new list,
    // mark it destroyed; new ones have no id.
    const nextKeywords = parseKeywords(keywords).map((k) => k.keyword);
    const existing = filter.keywords;
    const merged: Keyword[] = [];
    for (const kw of existing) {
      const stillPresent = nextKeywords.includes(kw.keyword);
      if (stillPresent) {
        merged.push({
          id: kw.id,
          keyword: kw.keyword,
          whole_word: kw.whole_word,
        });
      } else {
        merged.push({
          id: kw.id,
          keyword: kw.keyword,
          whole_word: false,
          _destroy: true,
        });
      }
    }
    for (const kw of nextKeywords) {
      const already = existing.some((x) => x.keyword === kw);
      if (!already) merged.push({ keyword: kw, whole_word: false });
    }
    try {
      const updated = await apiRequestPut<Filter>(`v2/filters/${filter.id}`, {
        title: title.trim(),
        context: contexts,
        filter_action: action,
        keywords_attributes: merged,
      });
      onChanged(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [filter, title, keywords, contexts, action, onChanged]);

  const handleSaveEdit = useCallback(() => {
    void saveEdit();
  }, [saveEdit]);

  const handleDelete = useCallback(() => {
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.deleteTitle),
        message: intl.formatMessage(messages.deleteMessage),
        confirmLabel: intl.formatMessage(messages.delete),
        destructive: true,
      });
      if (!ok) return;
      await apiRequestDelete(`v2/filters/${filter.id}`);
      onDeleted(filter.id);
    })();
  }, [confirm, intl, filter.id, onDeleted]);

  if (editing) {
    return (
      <div className='filters-settings__row filters-settings__row--editing'>
        <div className='settings-page__row settings-page__row--stack'>
          <input
            type='text'
            className='filters-settings__input'
            value={title}
            onChange={onTitleChange}
          />
        </div>
        <div className='settings-page__row settings-page__row--stack'>
          <input
            type='text'
            className='filters-settings__input'
            value={keywords}
            onChange={onKeywordsChange}
          />
        </div>
        <div className='filters-settings__contexts'>
          {ALL_CONTEXTS.map((c) => (
            <label key={c} className='filters-settings__chip'>
              <input
                type='checkbox'
                value={c}
                checked={contexts.includes(c)}
                onChange={onContextToggle}
              />
              {intl.formatMessage(
                CONTEXT_LABELS[c as keyof typeof CONTEXT_LABELS],
              )}
            </label>
          ))}
        </div>
        <div className='filters-settings__actions'>
          <label className='filters-settings__chip'>
            <input
              type='radio'
              name={`filter-${filter.id}-action`}
              value='warn'
              checked={action === 'warn'}
              onChange={onActionChange}
            />
            {intl.formatMessage(messages.actionWarn)}
          </label>
          <label className='filters-settings__chip'>
            <input
              type='radio'
              name={`filter-${filter.id}-action`}
              value='hide'
              checked={action === 'hide'}
              onChange={onActionChange}
            />
            {intl.formatMessage(messages.actionHide)}
          </label>
        </div>
        <div className='filters-settings__submit-row'>
          <button
            type='button'
            className='filters-settings__cancel'
            onClick={cancelEdit}
            disabled={saving}
          >
            {intl.formatMessage(messages.cancel)}
          </button>
          <button
            type='button'
            className='filters-settings__submit'
            onClick={handleSaveEdit}
            disabled={saving}
          >
            {intl.formatMessage(messages.saveEdit)}
          </button>
        </div>
        {confirmDialog}
      </div>
    );
  }

  return (
    <div className='filters-settings__row'>
      <div className='settings-page__row-body'>
        <div className='settings-page__row-label'>{filter.title}</div>
        <div className='settings-page__row-desc filters-settings__summary'>
          <span>{keywordsToString(filter.keywords)}</span>
          <span className='filters-settings__dot'>·</span>
          <span>{summariseContexts(filter.context)}</span>
          <span className='filters-settings__dot'>·</span>
          <span>
            {filter.filter_action === 'hide'
              ? intl.formatMessage(messages.actionHide)
              : intl.formatMessage(messages.actionWarn)}
          </span>
        </div>
      </div>
      <div className='filters-settings__row-actions'>
        <button
          type='button'
          className='filters-settings__link-btn'
          onClick={startEdit}
        >
          {intl.formatMessage(messages.edit)}
        </button>
        <button
          type='button'
          className='filters-settings__link-btn filters-settings__link-btn--destructive'
          onClick={handleDelete}
        >
          {intl.formatMessage(messages.delete)}
        </button>
      </div>
      {confirmDialog}
    </div>
  );
};

// ─── Page ────────────────────────────────────────────────────────────
export const FiltersSettings: React.FC = () => {
  const intl = useIntl();
  const [filters, setFilters] = useState<Filter[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<Filter[]>('v2/filters');
        if (!cancelled) setFilters(res);
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setFilters([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreated = useCallback((filter: Filter) => {
    setFilters((rows) => (rows ? [...rows, filter] : [filter]));
  }, []);
  const handleChanged = useCallback((filter: Filter) => {
    setFilters((rows) =>
      rows ? rows.map((r) => (r.id === filter.id ? filter : r)) : rows,
    );
  }, []);
  const handleDeleted = useCallback((id: string) => {
    setFilters((rows) => (rows ? rows.filter((r) => r.id !== id) : rows));
  }, []);

  const rows = useMemo(() => filters ?? [], [filters]);

  return (
    <SettingsPage
      title={intl.formatMessage(messages.title)}
      tagline={intl.formatMessage(messages.intro)}
    >
      <SettingsSection title={intl.formatMessage(messages.sectionNewTitle)}>
        <NewFilterForm onCreated={handleCreated} />
      </SettingsSection>

      <SettingsSection title={intl.formatMessage(messages.sectionListTitle)}>
        {loadError ? (
          <div className='settings-page__row-desc filters-settings__error'>
            {intl.formatMessage(messages.loadError)}
          </div>
        ) : filters === null ? null : rows.length === 0 ? (
          <div className='settings-page__row-desc'>
            {intl.formatMessage(messages.empty)}
          </div>
        ) : (
          rows.map((f) => (
            <FilterRow
              key={f.id}
              filter={f}
              onChanged={handleChanged}
              onDeleted={handleDeleted}
            />
          ))
        )}
      </SettingsSection>
    </SettingsPage>
  );
};

// eslint-disable-next-line import/no-default-export
export default FiltersSettings;
