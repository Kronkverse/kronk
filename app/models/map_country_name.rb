# frozen_string_literal: true

# == Schema Information
#
# Table name: map_country_names
#
#  id                    :bigint(8)        not null, primary key
#  name                  :string(60)       not null
#  folded                :string(60)       not null
#  shape_id              :integer
#  account_id            :bigint(8)
#  removed_at            :datetime
#  removed_by_account_id :bigint(8)
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#

# A name on the open list of First Nations Countries (docs/spaces/map.md,
# First Nations Country). The list stays open because names are still being
# found: every name typed on a profile joins it, and anyone can add another
# name to a Country on the map, which ties the name to that shape. Only a
# steward (admin or moderator) takes one off, and a name taken off stays off:
# typing it again doesn't bring it back.
class MapCountryName < ApplicationRecord
  NAME_LIMIT = Account::FirstNationsCountry::FIRST_NATIONS_COUNTRY_LIMIT

  belongs_to :account, optional: true
  belongs_to :removed_by_account, class_name: 'Account', optional: true

  scope :listed, -> { where(removed_at: nil) }

  validates :name, presence: true, length: { maximum: NAME_LIMIT }
  validates :folded, presence: true, uniqueness: true
  validates :shape_id, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true

  before_validation { self.folded = self.class.fold(name) }

  # Case, accents, ŋ, spacing and punctuation don't matter, the same as the
  # map's own matching (features/map_v2/country_layer.tsx), so "Yolngu" and
  # "Yolŋu" are one name.
  def self.fold(name)
    name.to_s.unicode_normalize(:nfd).gsub(/\p{Mn}/, '').gsub(/ŋ/i, 'ng').downcase.gsub(/[^a-z]/, '')
  end

  # A name someone typed on their profile: it joins the list unless it is
  # already there or was taken off.
  def self.note!(name, account)
    name = name.to_s.squish
    return if fold(name).blank?

    create!(name: name, account: account)
  rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique
    nil
  end

  def removed?
    removed_at.present?
  end

  def remove!(by)
    update!(removed_at: Time.current, removed_by_account: by)
  end
end
