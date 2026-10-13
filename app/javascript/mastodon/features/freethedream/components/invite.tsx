import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiFtdInvite } from 'mastodon/api/freethedream';
import { AccountMultiSelect } from 'mastodon/components/account_multi_select';
import type { AccountLite } from 'mastodon/components/account_multi_select';
import { ComposeShell } from 'mastodon/components/compose_shell';

import { errorOf } from './shared';

// Invite people to have a look at a project. Each gets a Nudge linking to
// its Overview; whether they get involved is up to them.

const messages = defineMessages({
  title: {
    id: 'freethedream.invite.title',
    defaultMessage: 'Invite to have a look',
  },
  subtitle: {
    id: 'freethedream.invite.subtitle',
    defaultMessage:
      'They get a nudge with a link to {title}, and choose whether to get involved.',
  },
  submit: { id: 'freethedream.invite.submit', defaultMessage: 'Send' },
  sending: { id: 'freethedream.invite.sending', defaultMessage: 'Sending…' },
});

interface Props {
  projectId: string;
  title: string;
  onSent: (count: number) => void;
  onCancel: () => void;
}

export const Invite: React.FC<Props> = ({
  projectId,
  title,
  onSent,
  onCancel,
}) => {
  const intl = useIntl();
  const [people, setPeople] = useState<AccountLite[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    setBusy(true);
    setError(null);
    apiFtdInvite(
      projectId,
      people.map((p) => p.id),
    )
      .then(({ invited }) => {
        onSent(invited);
      })
      .catch((err: unknown) => {
        setError(errorOf(err));
        setBusy(false);
      });
  }, [projectId, people, onSent]);

  return (
    <ComposeShell
      korner='freethedream'
      label={intl.formatMessage(messages.title)}
      subtitle={intl.formatMessage(messages.subtitle, { title })}
      submitLabel={intl.formatMessage(messages.submit)}
      submittingLabel={intl.formatMessage(messages.sending)}
      submitting={busy}
      canSubmit={people.length > 0}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    >
      <div className='freethedream-form'>
        <AccountMultiSelect
          value={people}
          onChange={setPeople}
          disabled={busy}
        />
        {error && (
          <p className='freethedream__error' role='alert'>
            {error}
          </p>
        )}
      </div>
    </ComposeShell>
  );
};
