import { useCallback, useId, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useSaveOwnProfile } from 'mastodon/hooks/useSaveOwnProfile';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

import { FIRST_NATIONS_COUNTRIES } from './first_nations_countries';

// The First Nations Country you live on, under your bio while you design your
// profile (docs/spaces/profile.md, Country). Type it, or pick a name from the
// Country map as you type; it saves when you leave the field. Shown to others
// as "On <name> Country".

const messages = defineMessages({
  label: {
    id: 'profile.country.label',
    defaultMessage: 'Whose Country do you live on?',
  },
  placeholder: {
    id: 'profile.country.placeholder',
    defaultMessage: 'e.g. Wurundjeri',
  },
  error: {
    id: 'profile.identity.error',
    defaultMessage: "Couldn't save — try again.",
  },
});

export const ProfileCountryField: React.FC = () => {
  const intl = useIntl();
  const listId = useId();
  const initial = useAppSelector((state) =>
    me ? (state.accounts.get(me)?.first_nations_country ?? '') : '',
  );
  const [value, setValue] = useState(initial);
  const { status, save } = useSaveOwnProfile();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);
  const handleBlur = useCallback(() => {
    if (value.trim() !== initial) save({ first_nations_country: value.trim() });
  }, [initial, save, value]);

  return (
    <div className='profile-block__country profile-block__country--editing'>
      <label className='profile-block__country-label'>
        {intl.formatMessage(messages.label)}
        <input
          type='text'
          className='profile-block__country-input'
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          maxLength={60}
          list={listId}
          autoComplete='off'
          placeholder={intl.formatMessage(messages.placeholder)}
        />
      </label>
      <datalist id={listId}>
        {FIRST_NATIONS_COUNTRIES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {status === 'error' && (
        <p className='profile-block__bio-error' role='alert'>
          {intl.formatMessage(messages.error)}
        </p>
      )}
    </div>
  );
};
