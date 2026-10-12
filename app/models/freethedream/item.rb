# frozen_string_literal: true

# FreeTheDream — an idea, need, job or offer inside a project
# (docs/spaces/freethedream.md, "The four kinds of item").
#
# An item belongs to one top-level project (root) and shows in one or more
# of its parts (placements). quantity means a need's amount, a job's slots
# or an offer's amount. An offer can be against a need, and can bring
# something from its owner's inventory.
module Freethedream
  class Item < ApplicationRecord
    self.table_name = 'freethedream_items'

    TITLE_MAX = 160
    BODY_MAX = 5000
    QUANTITY_MAX = 10_000_000

    CATEGORIES = { skills: 0, things: 1, space: 2, time: 3, money: 4, connections: 5 }.freeze

    belongs_to :root, class_name: 'Freethedream::Project'
    belongs_to :owner, class_name: 'Account', optional: true
    belongs_to :need, class_name: 'Freethedream::Item', optional: true
    belongs_to :asset, class_name: 'Freethedream::Asset', optional: true
    belongs_to :source_idea, class_name: 'Freethedream::Item', optional: true

    has_many :placements, class_name: 'Freethedream::Placement', dependent: :delete_all
    has_many :projects, through: :placements
    has_many :claims, class_name: 'Freethedream::Claim', dependent: :delete_all
    has_many :offers, class_name: 'Freethedream::Item', foreign_key: :need_id, inverse_of: :need, dependent: nil
    has_many :comments, class_name: 'Freethedream::Comment', as: :subject, dependent: :delete_all

    enum :kind, { idea: 0, need: 1, job: 2, offer: 3 }, suffix: :kind, validate: true
    enum :category, CATEGORIES, prefix: :category, validate: { allow_nil: true }

    validates :title, presence: true, length: { maximum: TITLE_MAX }
    validates :body, length: { maximum: BODY_MAX }
    validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: QUANTITY_MAX }
    validate :need_is_a_need
    validate :asset_is_owners

    def member?(account)
      root.member?(account)
    end

    def owned_by?(account)
      account.present? && owner_id == account.id
    end

    def up_for_grabs?
      owner_id.nil? || !root.member?(owner)
    end

    # A need: how much has been offered against it.
    def covered
      offers.sum(:quantity)
    end

    # A job: slots still free.
    def open_slots
      [quantity - claims.count, 0].max
    end

    # An idea someone took on becomes a part or a job.
    def taken_on_as
      Project.find_by(source_idea_id: id) || Item.find_by(source_idea_id: id)
    end

    private

    def need_is_a_need
      return if need_id.nil?

      errors.add(:need_id, :invalid) unless offer_kind? && need&.need_kind? && need.root_id == root_id
    end

    # Checked when the asset is set, not when the item changes hands: an
    # offer handed over keeps saying what it brings.
    def asset_is_owners
      return if asset_id.nil? || !will_save_change_to_asset_id?

      errors.add(:asset_id, :invalid) unless asset&.account_id == owner_id
    end
  end
end
