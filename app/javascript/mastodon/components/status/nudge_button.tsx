import { useCallback } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { IconButton } from 'mastodon/components/icon_button';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';
import { useIdentity } from 'mastodon/identity_context';
import { me } from 'mastodon/initial_state';

// The Nudge action: open the Nudges messenger with this post attached as a
// quoted card in the composer (the Signal/Instagram-style share-to-DM shape).
//
// Extracted so the feed bar and the post-detail bar render ONE implementation
// rather than two copies. The action bar is the platform's standard reaction
// pattern (Tal, 2026-08-12, #1407), and Nudge is one of its three actions —
// Reply · Froth · Nudge — so every surface showing a post should offer the same
// behaviour, including the same visibility rules.
//
// Those rules live here on purpose: signed-out visitors get nothing to click,
// and you cannot nudge yourself about your own post. Keeping the gate inside the
// component is what stops the two surfaces drifting apart.

const messages = defineMessages({
  nudge: { id: 'status.nudge', defaultMessage: 'Nudge @{name}' },
});

// Immutable status record — typed loosely because both call sites are still
// Immutable-based class components.
interface NudgeButtonProps {
  status: {
    getIn: (path: string[]) => unknown;
    get: (key: string) => unknown;
  };
  // Each bar styles its buttons differently, so the caller supplies the class
  // rather than the component guessing one that only suits the feed.
  className?: string;
}

export const NudgeButton: React.FC<NudgeButtonProps> = ({
  status,
  className,
}) => {
  const intl = useIntl();
  const history = useHistory();
  const { signedIn } = useIdentity();

  const accountId = status.getIn(['account', 'id']) as string | undefined;
  const username = status.getIn(['account', 'username']) as string | undefined;
  const writtenByMe = accountId === me;

  const handleClick = useCallback(() => {
    if (!accountId) return;

    // Strip markup and clip, so the composer shows a readable excerpt rather
    // than raw HTML.
    const rawBody = (
      (status.get('content') as string | undefined) ?? ''
    ).replace(/<[^>]*>/g, '');
    const statusBody =
      rawBody.length > 80 ? `${rawBody.slice(0, 80)}…` : rawBody;

    history.push(`/nudges/${accountId}`, {
      attachStatusUrl: status.get('url'),
      attachStatusBody: statusBody || null,
      attachStatusAuthorName:
        status.getIn(['account', 'display_name']) ??
        status.getIn(['account', 'username']),
      attachStatusAuthorAcct: status.getIn(['account', 'acct']),
      attachStatusAuthorAvatar: status.getIn(['account', 'avatar']),
    });
  }, [accountId, history, status]);

  if (!signedIn || writtenByMe) return null;

  return (
    <IconButton
      className={className}
      title={intl.formatMessage(messages.nudge, { name: username ?? '' })}
      icon='nudge'
      iconComponent={kornerIcon('nudges')}
      onClick={handleClick}
    />
  );
};
