import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  ComposeField,
  ComposeSelect,
} from 'mastodon/components/compose_fields';

import { KINDS, kindMessage } from '../kinds';
import type { BoothKind } from '../types';

// "What kind is it?" on the upload and edit forms. `kinds` narrows the
// choice: an album or EP can only be one of those, and one recording can't
// become one without its tracks.

const messages = defineMessages({
  label: { id: 'booth.kind.label', defaultMessage: 'What kind is it?' },
});

interface Props {
  value: BoothKind;
  onChange: (kind: BoothKind) => void;
  disabled?: boolean;
  kinds?: readonly BoothKind[];
}

export const KindSelect: React.FC<Props> = ({
  value,
  onChange,
  disabled,
  kinds = KINDS,
}) => {
  const intl = useIntl();
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value as BoothKind);
    },
    [onChange],
  );

  return (
    <ComposeField label={intl.formatMessage(messages.label)}>
      <ComposeSelect value={value} onChange={handleChange} disabled={disabled}>
        {kinds.map((kind) => (
          <option key={kind} value={kind}>
            {intl.formatMessage(kindMessage(kind))}
          </option>
        ))}
      </ComposeSelect>
    </ComposeField>
  );
};
