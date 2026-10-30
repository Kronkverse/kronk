# frozen_string_literal: true

# The First Nations Countries someone says they were born on and live on,
# shown as "Born on <name> Country" and "Living on <name> Country" under their
# bio (docs/spaces/profile.md, Country). Each is kept as the name alone: a
# trailing "Country" is dropped so it isn't said twice, and a blank one clears
# it. `first_nations_country` is where they live; it was the only one first.
# Each name typed joins the open list of Countries (MapCountryName).
module Account::FirstNationsCountry
  extend ActiveSupport::Concern

  FIRST_NATIONS_COUNTRY_LIMIT = 60
  FIRST_NATIONS_COUNTRY_FIELDS = %i(first_nations_country first_nations_country_born).freeze

  included do
    FIRST_NATIONS_COUNTRY_FIELDS.each do |field|
      before_validation -> { tidy_first_nations_country(field) }, if: -> { local? && will_save_change_to_attribute?(field) }
      validates field, length: { maximum: FIRST_NATIONS_COUNTRY_LIMIT },
                       if: -> { local? && will_save_change_to_attribute?(field) }
    end

    after_commit :note_first_nations_countries, if: :local?
  end

  private

  # Every name typed joins the open list of Countries (MapCountryName).
  def note_first_nations_countries
    FIRST_NATIONS_COUNTRY_FIELDS.each do |field|
      MapCountryName.note!(self[field], self) if saved_change_to_attribute?(field) && self[field].present?
    end
  end

  def tidy_first_nations_country(field)
    name = self[field].to_s.squish.sub(/\s+country\z/i, '')
    self[field] = name.presence
  end
end
