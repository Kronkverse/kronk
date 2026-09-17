import { FormattedMessage } from 'react-intl';

import { FollowButton } from 'mastodon/components/follow_button';

// Shown in place of a profile's content when the viewer is outside the
// account's `profile_visibility` reach scope (relationship.profile_visible
// is false). Everything about the profile is gated except the name + avatar
// (rendered by the header above this); this is the "become Mates to see
// more" prompt with the Mate action. The FollowButton resolves to the right
// label/action for the viewer's current relationship (Mate? / Requested / …).
export const ProfileGatedHint: React.FC<{ accountId: string }> = ({
  accountId,
}) => (
  <div className='profile-gated-hint'>
    <p className='profile-gated-hint__message'>
      <FormattedMessage
        id='profile.gated_hint'
        defaultMessage='You need to be Mates with this person to see more'
      />
    </p>
    <FollowButton accountId={accountId} />
  </div>
);
