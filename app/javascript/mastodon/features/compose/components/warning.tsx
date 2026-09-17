import { FormattedMessage } from 'react-intl';

import { createSelector } from '@reduxjs/toolkit';

import { animated, useSpring } from '@react-spring/web';

import { useAppSelector } from 'mastodon/store';
import type { RootState } from 'mastodon/store';
import { HASHTAG_PATTERN_REGEX } from 'mastodon/utils/hashtags';

// `needsLockWarning` (fired on `private`) and `directMessageWarning`
// (fired on `direct`) were retired in Phase 1B (2026-08-12) — those
// visibilities are no longer selectable in the composer, so both
// warnings became dead paths. The hashtag warning stays but the copy
// no longer references "unlisted" (that primitive is also gone).
const selector = createSelector(
  (state: RootState) => state.compose.get('privacy') as string,
  (state: RootState) => state.compose.get('text') as string,
  (privacy, text) => ({
    hashtagWarning: privacy !== 'public' && HASHTAG_PATTERN_REGEX.test(text),
  }),
);

export const Warning = () => {
  const { hashtagWarning } = useAppSelector(selector);

  if (hashtagWarning) {
    return (
      <WarningMessage>
        <FormattedMessage
          id='compose_form.hashtag_warning'
          defaultMessage="This post won't be listed under any hashtag — hashtags only surface on Kronkverse posts."
        />
      </WarningMessage>
    );
  }

  return null;
};

export const WarningMessage: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const styles = useSpring({
    from: {
      opacity: 0,
      transform: 'scale(0.85, 0.75)',
    },
    to: {
      opacity: 1,
      transform: 'scale(1, 1)',
    },
  });
  return (
    <animated.div className='compose-form__warning' style={styles}>
      {children}
    </animated.div>
  );
};
