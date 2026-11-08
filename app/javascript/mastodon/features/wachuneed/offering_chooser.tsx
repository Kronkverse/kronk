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

// The first step of adding to a shop (Tal, 2026-11-09): what are you
// offering? One large choice each, with a line saying what it is for. The
// choice opens the composer for that kind of offer.

const Choice: React.FC<{
  offering: ListingOffering;
  onPick: (offering: ListingOffering) => void;
}> = ({ offering, onPick }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onPick(offering);
  }, [offering, onPick]);

  return (
    <li>
      <button
        type='button'
        className='wachuneed-offering-choice'
        onClick={handleClick}
      >
        <span className='wachuneed-offering-choice__glyph'>
          <OfferingGlyph offering={offering} size={26} />
        </span>
        <span className='wachuneed-offering-choice__text'>
          <span className='wachuneed-offering-choice__name'>
            {intl.formatMessage(OFFERING_LABEL[offering].label)}
          </span>
          <span className='wachuneed-offering-choice__hint'>
            {intl.formatMessage(OFFERING_LABEL[offering].hint)}
          </span>
        </span>
      </button>
    </li>
  );
};

export const OfferingChooser: React.FC<{
  label: string;
  onPick: (offering: ListingOffering) => void;
  onCancel: () => void;
}> = ({ label, onPick, onCancel }) => {
  const intl = useIntl();

  return (
    <ComposeShell
      korner='wachuneed'
      label={label}
      submitLabel=''
      hideSubmit
      onSubmit={onCancel}
      onCancel={onCancel}
      konnect={null}
    >
      <p className='wachuneed-offering-question'>
        {intl.formatMessage(offeringMessages.question)}
      </p>
      <ul className='wachuneed-offering-choices'>
        {OFFERINGS.map((offering) => (
          <Choice key={offering} offering={offering} onPick={onPick} />
        ))}
      </ul>
    </ComposeShell>
  );
};
