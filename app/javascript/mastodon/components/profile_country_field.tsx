import { useCallback, useId, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useSaveOwnProfile } from 'mastodon/hooks/useSaveOwnProfile';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

import type { FirstNationsCountry } from './first_nations_countries';
import { FIRST_NATIONS_COUNTRIES } from './first_nations_countries';

// The First Nations Country you live on, under your bio while you design your
// profile (docs/spaces/profile.md, Country). Type it, or pick a name from the
// Country map as you type; it saves when you leave the field. Shown to others
// as "On <name> Country".
//
// The suggestions are Kronk's own list, not the browser's <datalist>: a
// datalist is drawn by the system in the system font and can't be styled, so
// it read as something outside Kronk.

const SUGGESTION_LIMIT = 8;

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

// Folded for matching: lower case, accents and ŋ read as plain letters, so
// "yolngu" finds Yolŋu.
const fold = (text: string) =>
  text
    .toLowerCase()
    .replace(/ŋ/g, 'ng')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Names (or their other spellings) that start with what's typed come first,
// then ones that contain it.
const suggestionsFor = (typed: string): FirstNationsCountry[] => {
  const query = fold(typed.trim());
  if (!query) return [];
  const starts: FirstNationsCountry[] = [];
  const contains: FirstNationsCountry[] = [];
  FIRST_NATIONS_COUNTRIES.forEach((country) => {
    const spellings = [country.name, ...(country.also ?? [])].map(fold);
    if (fold(country.name) === query) return;
    if (spellings.some((s) => s.startsWith(query))) starts.push(country);
    else if (spellings.some((s) => s.includes(query))) contains.push(country);
  });
  return [...starts, ...contains].slice(0, SUGGESTION_LIMIT);
};

// "Noongar · WA", "Eora · NSW & ACT", "VIC".
const whereOf = (country: FirstNationsCountry) =>
  [country.group, ...(country.also ?? []), country.region]
    .filter(Boolean)
    .join(' · ');

export const ProfileCountryField: React.FC = () => {
  const intl = useIntl();
  const listId = useId();
  const initial = useAppSelector((state) =>
    me ? (state.accounts.get(me)?.first_nations_country ?? '') : '',
  );
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { status, save } = useSaveOwnProfile();

  const suggestions = useMemo(() => suggestionsFor(value), [value]);
  const showing = open && suggestions.length > 0;

  const commit = useCallback(
    (next: string) => {
      if (next.trim() !== initial) save({ first_nations_country: next.trim() });
    },
    [initial, save],
  );

  const pick = useCallback(
    (name: string) => {
      setValue(name);
      setOpen(false);
      setActive(-1);
      commit(name);
    },
    [commit],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setOpen(true);
    setActive(-1);
  }, []);
  const handleFocus = useCallback(() => {
    setOpen(true);
  }, []);
  const handleBlur = useCallback(() => {
    setOpen(false);
    commit(value);
  }, [commit, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showing) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((was) => (was + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((was) => (was <= 0 ? suggestions.length - 1 : was - 1));
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        const country = suggestions[active];
        if (country) pick(country.name);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [showing, suggestions, active, pick],
  );

  // Pressing a suggestion would blur the field first and save what was typed;
  // holding the press keeps the focus so the pick is what saves.
  const holdFocus = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);
  const handlePick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const name = e.currentTarget.dataset.name;
      if (name) pick(name);
    },
    [pick],
  );

  return (
    <div className='profile-block__country profile-block__country--editing'>
      <label className='profile-block__country-label'>
        {intl.formatMessage(messages.label)}
        <input
          type='text'
          className='profile-block__country-input'
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          maxLength={60}
          autoComplete='off'
          role='combobox'
          aria-expanded={showing}
          aria-controls={listId}
          aria-autocomplete='list'
          aria-activedescendant={
            showing && active >= 0 ? `${listId}-${active}` : undefined
          }
          placeholder={intl.formatMessage(messages.placeholder)}
        />
      </label>
      {showing && (
        <ul id={listId} className='profile-block__country-list' role='listbox'>
          {suggestions.map(({ name, ...country }, index) => (
            <li
              key={`${name}-${country.region}`}
              id={`${listId}-${index}`}
              role='option'
              aria-selected={index === active}
            >
              <button
                type='button'
                tabIndex={-1}
                data-name={name}
                className={`profile-block__country-option${index === active ? ' profile-block__country-option--active' : ''}`}
                onMouseDown={holdFocus}
                onClick={handlePick}
              >
                <span className='profile-block__country-option-name'>
                  {name}
                </span>
                <span className='profile-block__country-option-where'>
                  {whereOf({ name, ...country })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {status === 'error' && (
        <p className='profile-block__bio-error' role='alert'>
          {intl.formatMessage(messages.error)}
        </p>
      )}
    </div>
  );
};
