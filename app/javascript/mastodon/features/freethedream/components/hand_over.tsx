import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiFtdProject } from 'mastodon/api/freethedream';
import type { FtdAccount } from 'mastodon/api_types/freethedream';
import {
  ComposeField,
  ComposeHint,
  ComposeSelect,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';

import { act } from './act';
import { errorOf } from './shared';

const messages = defineMessages({
  title: { id: 'freethedream.hand_over.title', defaultMessage: 'Hand over' },
  subtitle: {
    id: 'freethedream.hand_over.subtitle',
    defaultMessage: '{title} becomes theirs to run.',
  },
  to: { id: 'freethedream.hand_over.to', defaultMessage: 'To' },
  choose: {
    id: 'freethedream.hand_over.choose',
    defaultMessage: 'Choose someone',
  },
  submit: { id: 'freethedream.hand_over.submit', defaultMessage: 'Hand over' },
  saving: { id: 'freethedream.compose.saving', defaultMessage: 'Saving…' },
});

interface Props {
  rootId: string;
  title: string;
  selfId?: string;
  onHandOver: (accountId: string) => Promise<unknown>;
  onCancel: () => void;
}

// Pick another member of the project to hand something to.
export const HandOver: React.FC<Props> = ({
  rootId,
  title,
  selfId,
  onHandOver,
  onCancel,
}) => {
  const intl = useIntl();
  const [members, setMembers] = useState<FtdAccount[]>([]);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void act(
      apiFtdProject(rootId).then((root) => {
        setMembers(root.members.filter((m) => m.id !== selfId));
      }),
    );
  }, [rootId, selfId]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setChosen(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    setBusy(true);
    onHandOver(chosen).catch((err: unknown) => {
      setError(errorOf(err));
      setBusy(false);
    });
  }, [chosen, onHandOver]);

  return (
    <ComposeShell
      korner='freethedream'
      label={intl.formatMessage(messages.title)}
      subtitle={intl.formatMessage(messages.subtitle, { title })}
      submitLabel={intl.formatMessage(messages.submit)}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={busy}
      canSubmit={chosen !== ''}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    >
      <ComposeField label={intl.formatMessage(messages.to)}>
        <ComposeSelect value={chosen} onChange={handleChange}>
          <option value=''>{intl.formatMessage(messages.choose)}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name} (@{m.acct})
            </option>
          ))}
        </ComposeSelect>
      </ComposeField>
      {error && <ComposeHint error>{error}</ComposeHint>}
    </ComposeShell>
  );
};
