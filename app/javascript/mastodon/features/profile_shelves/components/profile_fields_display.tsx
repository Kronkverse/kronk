import { defineMessages, useIntl } from 'react-intl';

import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';

import { PROFILE_FIELD_BY_KEY } from '../profile_field_catalog';

// Read-side render of the structured profile fields — the view-mode
// counterpart to ProfileFieldsEditor. Fields are stored as profile_cards
// (card_type = the catalog key, answer in `body`); rather than render each as
// its own big told-shelf, we collect the catalog ones into a single compact
// "Profile fields" block (label + value). Non-field told cards + drawn korner
// sections still render as shelves in ShelvesStack.
//
// Only filled fields show (an added-but-empty field is not worth a row). The
// value is the serializer's sanitised HTML, same treatment ShelfTold gives a
// block card.

const messages = defineMessages({
  heading: {
    id: 'profile_shelves.fields.heading',
    defaultMessage: 'Profile fields',
  },
});

interface ProfileFieldsDisplayProps {
  cards: ApiProfileCardJSON[];
}

export const ProfileFieldsDisplay: React.FC<ProfileFieldsDisplayProps> = ({
  cards,
}) => {
  const intl = useIntl();

  const fields = cards.flatMap((card) => {
    const def = PROFILE_FIELD_BY_KEY[card.card_type];
    return def && card.body.trim().length > 0 ? [{ card, def }] : [];
  });

  if (fields.length === 0) return null;

  return (
    <section className='profile-fields-display'>
      <h3 className='profile-fields-display__heading'>
        {intl.formatMessage(messages.heading)}
      </h3>
      <dl className='profile-fields-display__list'>
        {fields.map(({ card, def }) => (
          <div className='profile-fields-display__row' key={card.id}>
            <dt className='profile-fields-display__label'>{def.label}</dt>
            <dd
              className='profile-fields-display__value'
              // Sanitised HTML from the serializer — same as ShelfTold's block.
              dangerouslySetInnerHTML={{ __html: card.body }}
            />
          </div>
        ))}
      </dl>
    </section>
  );
};
