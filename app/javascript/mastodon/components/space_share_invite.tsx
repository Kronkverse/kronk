import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useLocation } from 'react-router-dom';

import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import { apiRequestPost } from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { ShareSheet } from 'mastodon/components/share_sheet';
import { MatePicker } from 'mastodon/features/nudges_messenger/mate_picker';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useIdentity } from 'mastodon/identity_context';

// Share and Invite, on every page of every space (Tal 2026-10-13, Kommons
// "Share and Invite"). Both are Ж actions, registered from the Frame's
// header row, which every space page already has, so no space wires them
// up for itself. Invite was a pill in the header row's top right until
// Tal 2026-10-15 ("looks super clunky").
//
//   Share   the share sheet for this page's address (copy the link, send
//           it in Nudges, or the phone's own share). Someone without an
//           account who follows the link is asked to sign in.
//   Invite  pick a Mate and they are told, with your name, to come and
//           look. It changes nothing about who may see the page.

const HUB_ROUTE_RE = /^\/hub\/([a-z0-9-]+)/;

const messages = defineMessages({
  share: { id: 'space.share', defaultMessage: 'Share' },
  invite: { id: 'space.invite', defaultMessage: 'Invite' },
  inviteTitle: { id: 'space.invite.title', defaultMessage: 'Invite a Mate' },
  invited: { id: 'space.invite.done', defaultMessage: 'Invited' },
});

export const SpaceShareInvite: React.FC = () => {
  const intl = useIntl();
  const { signedIn } = useIdentity();
  const { pathname } = useLocation();
  const slug = HUB_ROUTE_RE.exec(pathname)?.[1];
  const korner = useKorner(slug);
  const here = signedIn && !!korner;

  const [sharing, setSharing] = useState(false);
  const [inviting, setInviting] = useState(false);
  // Who has been invited to this page since it was opened.
  const [invited, setInvited] = useState<{
    path: string;
    ids: ReadonlySet<string>;
  }>({ path: pathname, ids: new Set() });

  const openShare = useCallback(() => {
    setSharing(true);
  }, []);
  const closeShare = useCallback(() => {
    setSharing(false);
  }, []);
  const openInvite = useCallback(() => {
    setInviting(true);
  }, []);
  const closeInvite = useCallback(() => {
    setInviting(false);
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
  useRegisterPageAction(
    {
      key: 'space-invite',
      label: intl.formatMessage(messages.invite),
      icon: PersonAddIcon,
      iconId: 'person_add',
    },
    openInvite,
    here && !inviting,
  );

  const handlePick = useCallback(
    async (account: ApiAccountJSON) => {
      await apiRequestPost('v1/space_invites', {
        account_id: account.id,
        path: pathname,
      });
      setInvited((prev) => ({
        path: pathname,
        ids: new Set(prev.path === pathname ? prev.ids : []).add(account.id),
      }));
    },
    [pathname],
  );

  const invitedLabel = intl.formatMessage(messages.invited);
  const doneLabel = useCallback(
    (account: ApiAccountJSON) =>
      invited.path === pathname && invited.ids.has(account.id)
        ? invitedLabel
        : null,
    [invited, invitedLabel, pathname],
  );

  if (!here) return null;

  return (
    <>
      <ShareSheet
        open={sharing}
        onClose={closeShare}
        url={`${window.location.origin}${pathname}`}
        title={korner.name}
      />

      {inviting && (
        <MatePicker
          title={intl.formatMessage(messages.inviteTitle)}
          onPick={handlePick}
          doneLabel={doneLabel}
          onClose={closeInvite}
        />
      )}
    </>
  );
};
