import { useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import type { Map as ImmutableMap } from 'immutable';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { composeOnProfile } from 'mastodon/actions/compose';
import { IconButton } from 'mastodon/components/icon_button';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

// "Posting on @ana's profile", above the composer, while that is what the
// post is (docs/spaces/profile.md, Posts from Mates). The x makes it an
// ordinary post again and keeps what has been written.

const messages = defineMessages({
  cancel: {
    id: 'compose.profile_target.cancel',
    defaultMessage: 'Post it as an ordinary post',
  },
});

export const ProfileTargetIndicator: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const target = useAppSelector(
    (state) =>
      state.compose.get('profile_target') as ImmutableMap<
        string,
        string
      > | null,
  );

  const handleCancel = useCallback(() => {
    dispatch(composeOnProfile(null));
  }, [dispatch]);

  if (!target) return null;

  return (
    <div className='compose-form__profile-target'>
      <FormattedMessage
        id='compose.profile_target'
        defaultMessage='Posting on {name}’s profile'
        values={{ name: <strong>{target.get('name')}</strong> }}
      />
      <IconButton
        icon='close'
        iconComponent={CloseIcon}
        title={intl.formatMessage(messages.cancel)}
        onClick={handleCancel}
      />
    </div>
  );
};
