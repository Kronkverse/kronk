import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  ComposeCheck,
  ComposeSection,
} from 'mastodon/components/compose_fields';

import type { BoothVibe } from '../types';
import { VIBES, VIBES_MAX, isVibe, vibeHint, vibeName } from '../vibes';

// "What's the vibe?" on the upload and edit forms: up to two of the four,
// each with its line (docs/spaces/booth.md, Vibes). Once two are ticked the
// others wait until one comes off.

const messages = defineMessages({
  title: {
    id: 'booth.vibes.field',
    defaultMessage: 'What’s the vibe? Up to two',
  },
});

interface Props {
  value: BoothVibe[];
  onChange: (vibes: BoothVibe[]) => void;
  disabled?: boolean;
}

export const VibesField: React.FC<Props> = ({ value, onChange, disabled }) => {
  const intl = useIntl();
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const vibe = e.target.value;
      if (!isVibe(vibe)) return;
      onChange(
        e.target.checked
          ? VIBES.filter((v) => v === vibe || value.includes(v))
          : value.filter((v) => v !== vibe),
      );
    },
    [value, onChange],
  );
  const full = value.length >= VIBES_MAX;

  return (
    <ComposeSection
      title={intl.formatMessage(messages.title)}
      className='booth-vibes-field'
    >
      {VIBES.map((vibe) => {
        const checked = value.includes(vibe);
        return (
          <ComposeCheck
            key={vibe}
            value={vibe}
            checked={checked}
            onChange={handleChange}
            disabled={disabled === true || (full && !checked)}
            label={intl.formatMessage(vibeName(vibe))}
            hint={intl.formatMessage(vibeHint(vibe))}
          />
        );
      })}
    </ComposeSection>
  );
};
