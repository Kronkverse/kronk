/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * cancelled mutates in the useEffect cleanup after an async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState } from 'react';

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
});

export const HomeStatusBox: React.FC = () => {
  const intl = useIntl();
  const [placeholder, setPlaceholder] = useState<string>(
    intl.formatMessage(messages.fallbackPlaceholder),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGetKuestionsDailyPrompt();
        if (!cancelled && data.prompt) {
          setPlaceholder(data.prompt);
        }
      } catch {
        // Silent — fallback placeholder stays.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className='home-status-box'>
      <ComposeFormContainer
        withoutNavigation
        placeholderText={placeholder}
        publishLabel={intl.formatMessage(messages.publishLabel)}
      />
    </div>
  );
};
