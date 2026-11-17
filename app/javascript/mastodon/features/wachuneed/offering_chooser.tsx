import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { ListingOffering } from 'mastodon/api_types/wachuneed';
import { ComposeShell } from 'mastodon/components/compose_shell';

import {
  OFFERINGS,
  OFFERING_LABEL,
  OfferingGlyph,
  offeringMessages,
} from './offering';

// The first step of a listing: one large choice each, with a line saying
// what it is for, and the choice opens the composer for that kind. What
// are you offering? (Tal, 2026-11-09) for something on offer; What are
// you posting? (posting_chooser.tsx, 2026-11-17) puts the two kinds of
// wanted ad under it, so + reaches both.

export interface KindChoice<K extends string> {
  key: K;
  name: string;
  hint: string;
  glyph: React.ReactNode;
}

const Choice = <K extends string>({
  choice,
  onPick,
}: {
  choice: KindChoice<K>;
  onPick: (key: K) => void;
}) => {
  const handleClick = useCallback(() => {
    onPick(choice.key);
  }, [choice.key, onPick]);

  return (
    <li>
      <button
        type='button'
        className='wachuneed-offering-choice'
        onClick={handleClick}
      >
        <span className='wachuneed-offering-choice__glyph'>{choice.glyph}</span>
        <span className='wachuneed-offering-choice__text'>
          <span className='wachuneed-offering-choice__name'>{choice.name}</span>
          <span className='wachuneed-offering-choice__hint'>{choice.hint}</span>
        </span>
      </button>
    </li>
  );
};

export const KindChoices = <K extends string>({
  choices,
  onPick,
}: {
  choices: KindChoice<K>[];
  onPick: (key: K) => void;
}) => (
  <ul className='wachuneed-offering-choices'>
    {choices.map((choice) => (
      <Choice key={choice.key} choice={choice} onPick={onPick} />
    ))}
  </ul>
);

// `children` follow the choices: a second set under its own heading.
export const KindChooser = <K extends string>({
  label,
  question,
  choices,
  onPick,
  onCancel,
  children,
}: {
  label: string;
  question: string;
  choices: KindChoice<K>[];
  onPick: (key: K) => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) => (
  <ComposeShell
    korner='wachuneed'
    label={label}
    submitLabel=''
    hideSubmit
    onSubmit={onCancel}
    onCancel={onCancel}
    konnect={null}
  >
    <p className='wachuneed-offering-question'>{question}</p>
    <KindChoices choices={choices} onPick={onPick} />
    {children}
  </ComposeShell>
);

export const OfferingChooser: React.FC<{
  label: string;
  onPick: (offering: ListingOffering) => void;
  onCancel: () => void;
}> = ({ label, onPick, onCancel }) => {
  const intl = useIntl();
  const choices = OFFERINGS.map((offering) => ({
    key: offering,
    name: intl.formatMessage(OFFERING_LABEL[offering].label),
    hint: intl.formatMessage(OFFERING_LABEL[offering].hint),
    glyph: <OfferingGlyph offering={offering} size={26} />,
  }));

  return (
    <KindChooser
      label={label}
      question={intl.formatMessage(offeringMessages.question)}
      choices={choices}
      onPick={onPick}
      onCancel={onCancel}
    />
  );
};
