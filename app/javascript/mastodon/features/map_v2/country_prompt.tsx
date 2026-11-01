import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useSaveOwnProfile } from 'mastodon/hooks/useSaveOwnProfile';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

// Pin-drop (docs/spaces/map.md, First Nations Country): once you place your
// pin, the map offers the Country it is on as where you live — "You're on
// Kaurna Country. Add it as where you live?" — unless your profile already
// says so. One tap saves it to your profile's "Living on <name> Country".
// The Country comes from the server, worked out from your pin's coarsened
// point, so near a border it can be the neighbour; you're asked, not told.

const messages = defineMessages({
  question: {
    id: 'map.country_prompt.question',
    defaultMessage: "You're on {name} Country. Add it as where you live?",
  },
  add: { id: 'map.country_prompt.add', defaultMessage: 'Add' },
  notNow: { id: 'map.country_prompt.not_now', defaultMessage: 'Not now' },
  saved: {
    id: 'map.country_prompt.saved',
    defaultMessage: 'Added. Your profile says Living on {name} Country.',
  },
  ok: { id: 'map.country_prompt.ok', defaultMessage: 'OK' },
  error: {
    id: 'map.country_prompt.error',
    defaultMessage: "Couldn't save. Try again.",
  },
});

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ŋ/gi, 'ng')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

// Whether to ask at all: a named Country that isn't already where you live.
export const useShouldOfferCountry = (name: string | null | undefined) => {
  const living = useAppSelector((state) =>
    me ? (state.accounts.get(me)?.first_nations_country ?? '') : '',
  );
  return !!name && fold(name) !== fold(living);
};

export const CountryPrompt: React.FC<{
  name: string;
  onDone: () => void;
}> = ({ name, onDone }) => {
  const intl = useIntl();
  const { status, save } = useSaveOwnProfile();

  const add = useCallback(() => {
    save({ first_nations_country: name });
  }, [name, save]);

  if (status === 'saved') {
    return (
      <div className='map-country-prompt' role='status'>
        <p className='map-country-prompt__text'>
          {intl.formatMessage(messages.saved, { name })}
        </p>
        <div className='map-country-prompt__actions'>
          <button
            type='button'
            className='map-country-prompt__button'
            onClick={onDone}
          >
            {intl.formatMessage(messages.ok)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='map-country-prompt' role='dialog' aria-live='polite'>
      <p className='map-country-prompt__text'>
        {intl.formatMessage(messages.question, { name })}
      </p>
      {status === 'error' && (
        <p className='map-country-prompt__error' role='alert'>
          {intl.formatMessage(messages.error)}
        </p>
      )}
      <div className='map-country-prompt__actions'>
        <button
          type='button'
          className='map-country-prompt__button'
          onClick={onDone}
        >
          {intl.formatMessage(messages.notNow)}
        </button>
        <button
          type='button'
          className='map-country-prompt__button map-country-prompt__button--primary'
          onClick={add}
          disabled={status === 'saving'}
        >
          {intl.formatMessage(messages.add)}
        </button>
      </div>
    </div>
  );
};
