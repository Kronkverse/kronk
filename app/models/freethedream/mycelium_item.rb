# frozen_string_literal: true

# Something in a person's Mycelium: what they have, in one of six
# categories (docs/spaces/freethedream.md, Mycelium). Private to its owner.
# Sharing it into an emergence they're in is offering it there: an offer
# (Item kind offer) linked back to it, on its own or against a need.
module Freethedream
  class MyceliumItem < ApplicationRecord
    self.table_name = 'freethedream_mycelium_items'

    TITLE_MAX = 160
    NOTE_MAX = 1000

    belongs_to :account
    has_many :offers, class_name: 'Freethedream::Item', inverse_of: :mycelium_item, dependent: nil

    enum :category, Item::CATEGORIES, prefix: :category, validate: true

    validates :category, presence: true
    validates :title, presence: true, length: { maximum: TITLE_MAX }
    validates :note, length: { maximum: NOTE_MAX }
    validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: Item::QUANTITY_MAX }

    scope :by_category, -> { order(:category, :title) }

    # Taking something out of your Mycelium takes back what it offers on
    # its own. What you said you'd bring against a need stays: someone may
    # be counting on it (its link to here goes, by the foreign key).
    before_destroy :withdraw_offers

    # Share this into an emergence its owner is in, which is offering it
    # there: it shows in On offer. One offer per emergence; sharing again
    # changes how many. (Bringing it against a need goes through
    # ItemsController#bring, which links the offer back here.)
    def offer!(emergence, quantity: self.quantity)
      offer = offers.find_or_initialize_by(root_id: emergence.id, need_id: nil)
      offer.assign_attributes(kind: :offer, owner: account, title: title, category: category, quantity: quantity.to_i.clamp(1, Item::QUANTITY_MAX))
      Item.transaction do
        offer.save!
        offer.placements.find_or_create_by!(project: emergence)
      end
      offer
    end

    def withdraw!(project)
      offers.where(root_id: project.id, need_id: nil).find_each(&:destroy!)
    end

    private

    def withdraw_offers
      offers.where(need_id: nil).find_each(&:destroy!)
    end
  end
end
