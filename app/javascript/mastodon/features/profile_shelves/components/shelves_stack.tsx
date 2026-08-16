import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';

import { PROFILE_FIELD_BY_KEY } from '../profile_field_catalog';

import { ProfileFieldsDisplay } from './profile_fields_display';
import { ShelfDrawn } from './shelf_drawn';
import { ShelfTold } from './shelf_told';

// Renders the profile's shelves. MVP-simple stacking: told cards
// first (in their own position order), then drawn sections (in
// theirs). A shared position column across both is the interleaving
// path the mock hints at; deferred to a follow-up. Both models
// already have their own `visible` toggle + reach ladder, so a
// stranger only sees the subset they're allowed to.

interface ShelvesStackProps {
  accountId: string;
  cards: ApiProfileCardJSON[];
  sections: ApiProfileSectionJSON[];
}

export const ShelvesStack: React.FC<ShelvesStackProps> = ({
  accountId,
  cards,
  sections,
}) => {
  // Catalog fields render together in the compact "Profile fields" block;
  // everything else (any non-field told card) still renders as its own shelf.
  const fieldCards = cards.filter((c) => PROFILE_FIELD_BY_KEY[c.card_type]);
  const toldCards = cards.filter((c) => !PROFILE_FIELD_BY_KEY[c.card_type]);

  return (
    <div className='profile-shelves__stack'>
      <ProfileFieldsDisplay cards={fieldCards} />
      {toldCards.map((card) => (
        <ShelfTold key={`card-${card.id}`} card={card} />
      ))}
      {sections.map((section) => (
        <ShelfDrawn
          key={`section-${section.id}`}
          accountId={accountId}
          section={section}
        />
      ))}
    </div>
  );
};
