/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * cancelled mutates in the useEffect cleanup after an async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useCallback, useEffect, useState } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import { apiGetKuestionsDailyPrompt } from 'mastodon/api/kuestions';
import ComposeFormContainer from 'mastodon/features/compose/containers/compose_form_container';

// Inline status composer on the Home column. Sits below the Moments
// strip and above the first post. Reuses the global compose reducer +
// actions so media upload, visibility, mentions, emoji, polls all work
// for free; the only Kronk touches are the placeholder (the day's
// Kuestion prompt from /api/v2/kuestions/prompt/today) and the submit
// label ("Kronk it" instead of "Post").
//
// Collapsed by default: a single-line pill showing the daily prompt +
// a Ж sigil button. Click either → expands into the full compose form.
// The full form takes focus so typing starts immediately.
//
// One-Redux-slice by design: if the user opens /publish mid-typing they
// see the same draft. That's intentional — Kronk is one place to
// compose, this is just a lightweight inline surface for it.

const messages = defineMessages({
  fallbackPlaceholder: {
    id: 'home.status_box.placeholder_fallback',
    defaultMessage: 'What is on your mind?',
  },
  publishLabel: {
    id: 'home.status_box.publish',
    defaultMessage: 'Kronk it',
  },
  expandLabel: {
    id: 'home.status_box.expand',
    defaultMessage: 'Open the composer',
  },
  tabToAnswer: {
    id: 'home.status_box.tab_to_answer',
    defaultMessage: '(tab to answer)',
  },
});

export const HomeStatusBox: React.FC = () => {
  const intl = useIntl();
  const fallback = intl.formatMessage(messages.fallbackPlaceholder);
  // `prompt` is null when the day's Kuestion hasn't been fetched or the
  // request failed — the collapsed pill and composer both fall back to
  // the generic placeholder in that case, and Tab is a no-op.
  const [prompt, setPrompt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGetKuestionsDailyPrompt();
        if (!cancelled && data.prompt) {
          setPrompt(data.prompt);
        }
      } catch {
        // Silent — fallback stays.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleExpand = useCallback(() => {
    setExpanded(true);
  }, []);

  const placeholder = prompt ?? fallback;
  const tabHint = intl.formatMessage(messages.tabToAnswer);

  if (!expanded) {
    return (
      <div className='home-status-box home-status-box--collapsed'>
        <button
          type='button'
          className='home-status-box__collapsed-input'
          onClick={handleExpand}
          aria-label={intl.formatMessage(messages.expandLabel)}
        >
          <span className='home-status-box__collapsed-text'>
            {placeholder}
            {prompt && (
              <span className='home-status-box__tab-hint'> {tabHint}</span>
            )}
          </span>
        </button>
        <button
          type='button'
          className='home-status-box__sigil'
          onClick={handleExpand}
          aria-label={intl.formatMessage(messages.expandLabel)}
        >
          Ж
        </button>
      </div>
    );
  }

  return (
    <div className='home-status-box'>
      <ComposeFormContainer
        withoutNavigation
        /* eslint-disable-next-line jsx-a11y/no-autofocus --
         * The user just clicked the collapsed pill to expand the composer;
         * focusing the textarea is exactly what they intend. Not applied
         * on initial render, only after an intentional expand action. */
        autoFocus
        placeholderText={prompt ? `${placeholder} ${tabHint}` : placeholder}
        publishLabel={intl.formatMessage(messages.publishLabel)}
        insertOnTab={prompt ?? undefined}
      />
    </div>
  );
};
