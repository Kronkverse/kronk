import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { FtdProjektKind } from 'mastodon/api_types/freethedream';
import { ComposeShell } from 'mastodon/components/compose_shell';

import { PROJEKT_KINDS, kindHint, kindMessages, kindName } from './kinds';

// The first step of seeding a projekt (Tal, 2026-11-10), as Wachuneed's
// What are you offering? is: one large choice per kind, with a line saying
// what it's for. The choice opens the composer.

const Choice: React.FC<{
  kind: FtdProjektKind;
  onPick: (kind: FtdProjektKind) => void;
}> = ({ kind, onPick }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onPick(kind);
  }, [kind, onPick]);

  return (
    <li>
      <button
        type='button'
        className='freethedream-kind-choice'
        onClick={handleClick}
      >
        <span className='freethedream-kind-choice__name'>
          {intl.formatMessage(kindName(kind))}
        </span>
        <span className='freethedream-kind-choice__hint'>
          {intl.formatMessage(kindHint(kind))}
        </span>
      </button>
    </li>
  );
};

export const KindChooser: React.FC<{
  label: string;
  onPick: (kind: FtdProjektKind) => void;
  onCancel: () => void;
}> = ({ label, onPick, onCancel }) => {
  const intl = useIntl();

  return (
    <ComposeShell
      korner='freethedream'
      label={label}
      submitLabel=''
      hideSubmit
      onSubmit={onCancel}
      onCancel={onCancel}
      konnect={null}
    >
      <p className='freethedream-kind-question'>
        {intl.formatMessage(kindMessages.question)}
      </p>
      <ul className='freethedream-kind-choices'>
        {PROJEKT_KINDS.map((kind) => (
          <Choice key={kind} kind={kind} onPick={onPick} />
        ))}
      </ul>
    </ComposeShell>
  );
};
