import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useSaveOwnProfile } from 'mastodon/hooks/useSaveOwnProfile';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';
import { unescapeHTML } from 'mastodon/utils/html';

// Your bio, editable where it shows (under your counts in the profile
// block) while you design your profile. Saves when
// you leave the field.

const messages = defineMessages({
  bio: { id: 'profile.identity.bio', defaultMessage: 'Bio' },
  placeholder: {
    id: 'profile_shelves.bio_placeholder',
    defaultMessage: 'A line or two about you',
  },
  error: {
    id: 'profile.identity.error',
    defaultMessage: "Couldn't save — try again.",
  },
});

export const ProfileBioField: React.FC = () => {
  const intl = useIntl();
  const note = useAppSelector((state) =>
    me ? (state.accounts.get(me)?.note ?? '') : '',
  );
  const initial = unescapeHTML(note);
  const [value, setValue] = useState(initial);
  const { status, save } = useSaveOwnProfile();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
    },
    [],
  );
  const handleBlur = useCallback(() => {
    if (value !== initial) save({ note: value });
  }, [initial, save, value]);

  return (
    <div className='profile-block__bio profile-block__bio--editing'>
      <textarea
        className='profile-block__bio-input'
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={500}
        rows={3}
        aria-label={intl.formatMessage(messages.bio)}
        placeholder={intl.formatMessage(messages.placeholder)}
      />
      {status === 'error' && (
        <p className='profile-block__bio-error' role='alert'>
          {intl.formatMessage(messages.error)}
        </p>
      )}
    </div>
  );
};
