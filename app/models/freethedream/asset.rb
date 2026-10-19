# frozen_string_literal: true

# Something in a person's inventory, for the synergistic audit
# (docs/spaces/freethedream.md). Private to its owner until they share it
# into a project they're in.
module Freethedream
  class Asset < ApplicationRecord
    self.table_name = 'freethedream_assets'

    TITLE_MAX = 160
    NOTE_MAX = 1000

    belongs_to :account
    has_many :shares, class_name: 'Freethedream::Share', dependent: :delete_all
    has_many :projects, through: :shares

    enum :category, Item::CATEGORIES, prefix: :category, validate: true

    validates :category, presence: true
    validates :title, presence: true, length: { maximum: TITLE_MAX }
    validates :note, length: { maximum: NOTE_MAX }
    validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: Item::QUANTITY_MAX }

    scope :by_category, -> { order(:category, :title) }
  end
end
