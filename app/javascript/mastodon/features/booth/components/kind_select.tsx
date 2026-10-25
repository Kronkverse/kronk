import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  ComposeField,
  ComposeSelect,
} from 'mastodon/components/compose_fields';

import { KINDS, kindMessage } from '../kinds';
import type { BoothKind } from '../types';

// "What kind is it?" on the upload and edit forms.

const messages = defineMessages({
  label: { id: 'booth.kind.label', defaultMessage: 'What kind is it?' },
});

interface Props {
  value: BoothKind;
  onChange: (kind: BoothKind) => void;
  disabled?: boolean;
}

export const KindSelect: React.FC<Props> = ({ value, onChange, disabled }) => {
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
        {KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {intl.formatMessage(kindMessage(kind))}
          </option>
        ))}
      </ComposeSelect>
    </ComposeField>
  );
};
