import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import KuestionIcon from '@/material-icons/400-24px/kuestion.svg?react';
import { changeCompose } from 'mastodon/actions/compose';
import api from 'mastodon/api';
import { apiGetKuestionsDailyPrompt } from 'mastodon/api/kuestions';
import { Icon } from 'mastodon/components/icon';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  use: {
    id: 'compose.daily_prompt.use',
    defaultMessage: "Today's Kuestion: {prompt}. Tap to answer it here.",
  },
});

interface SettingsPayload {
  settings: { name: string; value?: unknown; default?: unknown }[];
}

// Today's prompt and the viewer's "Daily prompt in my post box" setting,
// fetched once per page load and day, so opening the composer again
// doesn't refetch.
let cached: { date: string; prompt: string | null } | null = null;

const today = () => new Date().toDateString();

const loadPrompt = async (): Promise<string | null> => {
  if (cached?.date === today()) return cached.prompt;

  const [prompt, settings] = await Promise.all([
    apiGetKuestionsDailyPrompt(),
    api().get<SettingsPayload>('/api/v1/korners/kuestions/settings'),
  ]);
  const row = settings.data.settings.find(
    (s) => s.name === 'daily_prompt_in_post_box',
  );
  const on = (row?.value ?? row?.default ?? true) !== false;

  cached = { date: today(), prompt: on ? prompt.prompt : null };
  return cached.prompt;
};

// Kuestions' daily prompt in the post box's top bar, between who's posting
// and the reach picker: faint, with the Kuestions icon. Only on a fresh
// post (not a comment or an edit), and only while the viewer is tuned in
// to Kuestions. Tapping it starts the post with the prompt.
export const ComposeDailyPrompt: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const tunedIn = useKorner('kuestions')?.tuned_in === true;
  const text = useAppSelector((state) => state.compose.get('text') as string);
  const fresh = useAppSelector(
    (state) =>
      state.compose.get('in_reply_to') === null &&
      state.compose.get('id') === null,
  );
  const [prompt, setPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (!tunedIn) return;

    let cancelled = false;
    loadPrompt()
      .then((p) => {
        if (!cancelled) setPrompt(p);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tunedIn]);

  const handleClick = useCallback(() => {
    if (!prompt || text.startsWith(prompt)) return;

    dispatch(changeCompose(text ? `${prompt}\n\n${text}` : `${prompt}\n\n`));
  }, [dispatch, prompt, text]);

  if (!tunedIn || !fresh || !prompt) return null;

  const label = intl.formatMessage(messages.use, { prompt });

  return (
    <button
      type='button'
      className='compose-form__daily-prompt'
      onClick={handleClick}
      title={label}
      aria-label={label}
    >
      <Icon id='kuestion' icon={KuestionIcon} />
      <span className='compose-form__daily-prompt__text'>{prompt}</span>
    </button>
  );
};
