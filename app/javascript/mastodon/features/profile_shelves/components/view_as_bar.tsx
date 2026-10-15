import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ProfileAudience } from 'mastodon/api/profile_sections';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

// Over your own profile while you see it as others do (docs/spaces/
// profile.md, Who can see a profile): which circle you are seeing it as,
// and the way back to yourself. Started from the Ж menu.

const messages = defineMessages({
  heading: {
    id: 'profile_view_as.heading',
    defaultMessage: 'Your profile, as seen by',
  },
  mates: { id: 'profile_view_as.mates', defaultMessage: 'Mates' },
  orbit: { id: 'profile_view_as.orbit', defaultMessage: 'Orbit' },
  kronkverse: {
    id: 'profile_view_as.kronkverse',
    defaultMessage: 'Kronkverse',
  },
  hint: {
    id: 'profile_view_as.hint',
    defaultMessage:
      'Mates see the most. Orbit is Mates of your Mates. Kronkverse is anyone on Kronk. Your name and photo show to everyone on Kronk.',
  },
  done: { id: 'profile_view_as.done', defaultMessage: 'Back to my view' },
});

const AUDIENCES: ProfileAudience[] = ['mates', 'orbit', 'kronkverse'];

const AudiencePill: React.FC<{
  audience: ProfileAudience;
  active: boolean;
  onPick: (audience: ProfileAudience) => void;
}> = ({ audience, active, onPick }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onPick(audience);
  }, [audience, onPick]);

  return (
    <KornerPill
      label={intl.formatMessage(messages[audience])}
      active={active}
      onClick={handleClick}
    />
  );
};

export const ViewAsBar: React.FC<{
  value: ProfileAudience;
  onChange: (audience: ProfileAudience | null) => void;
}> = ({ value, onChange }) => {
  const intl = useIntl();
  const handleDone = useCallback(() => {
    onChange(null);
  }, [onChange]);

  return (
    <section
      className='profile-view-as'
      aria-label={intl.formatMessage(messages.heading)}
    >
      <p className='profile-view-as__heading'>
        {intl.formatMessage(messages.heading)}
      </p>
      <KornerActionBar>
        {AUDIENCES.map((audience) => (
          <AudiencePill
            key={audience}
            audience={audience}
            active={audience === value}
            onPick={onChange}
          />
        ))}
        <KornerPill
          label={intl.formatMessage(messages.done)}
          variant='primary'
          onClick={handleDone}
        />
      </KornerActionBar>
      <p className='profile-view-as__hint'>
        {intl.formatMessage(messages.hint)}
      </p>
    </section>
  );
};
