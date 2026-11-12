import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import type { ApiKuestionJSON } from 'mastodon/api_types/kuestions';
import { Icon } from 'mastodon/components/icon';
import { ShareSheet } from 'mastodon/components/share_sheet';

// Share a Kuestion: its own address, `/hub/kuestions/<id>`, which opens it
// to answer, or to its answers once you have (Tal, 2026-11-12: "I couldn't
// find a way to share a link to a specific kuestion"). The Kronk share
// sheet, as an event's page has.

const messages = defineMessages({
  share: { id: 'kuestions.share', defaultMessage: 'Share' },
});

export const kuestionPath = (id: string) => `/hub/kuestions/${id}`;

export const KuestionShare: React.FC<{ kuestion: ApiKuestionJSON }> = ({
  kuestion,
}) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <button type='button' className='kuestions-share' onClick={handleOpen}>
        <Icon id='share' icon={ShareIcon} aria-hidden />
        {intl.formatMessage(messages.share)}
      </button>
      <ShareSheet
        open={open}
        onClose={handleClose}
        url={`${window.location.origin}${kuestionPath(kuestion.id)}`}
        title={kuestion.title}
        body={kuestion.prompt}
        author={{
          name: kuestion.asker.display_name || kuestion.asker.username,
          acct: kuestion.asker.acct,
          avatar: kuestion.asker.avatar,
        }}
      />
    </>
  );
};
