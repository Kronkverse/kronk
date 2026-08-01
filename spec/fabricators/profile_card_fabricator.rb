# frozen_string_literal: true

Fabricator(:profile_card) do
  account
  card_type { ProfileCard::CARD_TYPES.first }
  position 0
end
