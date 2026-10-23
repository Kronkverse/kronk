# frozen_string_literal: true

# The First Nations Country someone says they live on, shown as "On <name>
# Country" under their bio (docs/spaces/profile.md, Country). Kept as the
# name alone: a trailing "Country" is dropped so it isn't said twice, and a
# blank one clears it.
module Account::FirstNationsCountry
  extend ActiveSupport::Concern

  FIRST_NATIONS_COUNTRY_LIMIT = 60

  included do
    before_validation :tidy_first_nations_country, if: -> { local? && will_save_change_to_first_nations_country? }
    validates :first_nations_country, length: { maximum: FIRST_NATIONS_COUNTRY_LIMIT },
                                      if: -> { local? && will_save_change_to_first_nations_country? }
  end

  private

  def tidy_first_nations_country
    name = first_nations_country.to_s.squish.sub(/\s+country\z/i, '')
    self.first_nations_country = name.presence
  end
end
