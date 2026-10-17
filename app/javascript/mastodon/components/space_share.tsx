import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useLocation } from 'react-router-dom';

import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import { ShareSheet } from 'mastodon/components/share_sheet';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useIdentity } from 'mastodon/identity_context';

// Share, on every page of every space (Tal 2026-10-13, Kommons "Share and
// Invite"). A Ж action registered from the Frame's header row, which every
// space page already has, so no space wires it up for itself. It opens the
// share sheet for this page's address: copy the link, send it in Nudges,
// or the phone's own share. Someone without an account who follows the
// link is asked to sign in.
//
// Invite, its partner, is gone (Tal 2026-10-17: "there should be no invite
// anywhere, only share").

const HUB_ROUTE_RE = /^\/hub\/([a-z0-9-]+)/;

const messages = defineMessages({
  share: { id: 'space.share', defaultMessage: 'Share' },
});

export const SpaceShare: React.FC = () => {
  const intl = useIntl();
  const { signedIn } = useIdentity();
  const { pathname } = useLocation();
  const slug = HUB_ROUTE_RE.exec(pathname)?.[1];
  const korner = useKorner(slug);
  const here = signedIn && !!korner;

  const [sharing, setSharing] = useState(false);

  const openShare = useCallback(() => {
    setSharing(true);
  }, []);
  const closeShare = useCallback(() => {
    setSharing(false);
  }, []);

  useRegisterPageAction(
    {
      key: 'space-share',
      label: intl.formatMessage(messages.share),
      icon: ShareIcon,
      iconId: 'share',
    },
    openShare,
    here && !sharing,
  );

  if (!here) return null;

  return (
    <ShareSheet
      open={sharing}
      onClose={closeShare}
      url={`${window.location.origin}${pathname}`}
      title={korner.name}
    />
  );
};
