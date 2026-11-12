import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { KornerShell } from 'mastodon/components/korner_shell';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { useIdentity } from 'mastodon/identity_context';

import { RoseSendPicker } from './send_picker';
import { RoseStackView } from './stack_view';

// Rose — /hub/rose. One view: the roses you were given today.
//
// No composer route and no views: list in the manifest. A rose is sent
// from a person's profile, or from here through the Ж menu's "Send a
// rose", which opens a picker of your Mates over this page. Title and
// tagline come from the Frame (Standard L11).

const messages = defineMessages({
  send: { id: 'rose.send.title', defaultMessage: 'Send a rose' },
});

const views = {
  stack: () => <RoseStackView />,
};

export const Rose: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const { signedIn } = useIdentity();
  // The hook, not kornerIcon(): opened straight onto this page, the korner
  // list may not have loaded yet, and the menu action would keep the
  // fallback circle.
  const roseIcon = useKornerIcon('rose');
  const [sending, setSending] = useState(false);

  const openPicker = useCallback(() => {
    setSending(true);
  }, []);
  const closePicker = useCallback(() => {
    setSending(false);
  }, []);

  useRegisterPageAction(
    useMemo(
      () => ({
        key: 'send-rose',
        label: intl.formatMessage(messages.send),
        icon: roseIcon,
        iconId: 'rose',
      }),
      [intl, roseIcon],
    ),
    openPicker,
    signedIn && !sending,
  );

  return (
    <>
      <KornerShell
        slug='rose'
        label='Rose'
        className='scrollable rose'
        defaultView='stack'
        views={views}
      />
      {sending && <RoseSendPicker onClose={closePicker} />}
    </>
  );
};
