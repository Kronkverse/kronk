import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { ComposeSection } from 'mastodon/components/compose_fields';
import { KornerPill } from 'mastodon/components/korner_pill';

// How many of a thing: One unless you say Many, and only Many asks for a
// number (Kommons "Bringing multiples", Tal, 2026-11-26). Money always
// has an amount, so the composers skip this for it.

const messages = defineMessages({
  howMany: { id: 'freethedream.compose.how_many', defaultMessage: 'How many' },
  one: { id: 'freethedream.compose.one', defaultMessage: 'One' },
  many: { id: 'freethedream.compose.many', defaultMessage: 'Many' },
});

// Whether a saved amount reads as Many: more than one, or counted in a unit.
export const isMany = (quantity: number | string | undefined, unit?: string) =>
  Number(quantity ?? 1) > 1 || (unit ?? '').trim() !== '';

export const OneOrMany: React.FC<{
  many: boolean;
  onChange: (many: boolean) => void;
}> = ({ many, onChange }) => {
  const intl = useIntl();
  const chooseOne = useCallback(() => {
    onChange(false);
  }, [onChange]);
  const chooseMany = useCallback(() => {
    onChange(true);
  }, [onChange]);

  return (
    <ComposeSection title={intl.formatMessage(messages.howMany)}>
      <div className='freethedream-compose__amount'>
        <KornerPill
          label={intl.formatMessage(messages.one)}
          active={!many}
          onClick={chooseOne}
        />
        <KornerPill
          label={intl.formatMessage(messages.many)}
          active={many}
          onClick={chooseMany}
        />
      </div>
    </ComposeSection>
  );
};
