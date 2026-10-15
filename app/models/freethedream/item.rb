# frozen_string_literal: true

# FreeTheDream — something in Thing Bringing (a need), Actualise (a job)
# or On offer (an offer) inside an emergence (docs/spaces/freethedream.md,
# "The kinds of item"). Ideas are no longer made (2026-10-15): an idea is
# an Actualise item with whoever had it on it. Old taken-on ideas stay as
# `idea` rows and don't show.
#
# An item belongs to one emergence (root) and shows in one or more of its
# gangs (placements). quantity means a need's or an offer's amount; an
# Actualise item is open-ended, with any number of people on it. An offer
# can be against a need, and can bring something from its owner's
# inventory.
module Freethedream
  class Item < ApplicationRecord
    self.table_name = 'freethedream_items'

    TITLE_MAX = 160
    BODY_MAX = 5000
    QUANTITY_MAX = 10_000_000
    UNIT_MAX = 20

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
    validates :unit, length: { maximum: UNIT_MAX }
    validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: QUANTITY_MAX }
    validate :need_is_a_need
    validate :no_new_ideas, on: :create
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
      offers.loaded? ? offers.sum(&:quantity) : offers.sum(:quantity)
    end

    # A need: how much is still to find.
    def left
      [quantity - covered, 0].max
    end

    # Actualise: somebody is on it.
    def actualised?
      claims.loaded? ? claims.any? : claims.exists?
    end

    # Something to bring is sorted once anyone is bringing it, whatever
    # the amount: less about numbers (Tal, 2026-10-15), and someone
    # bringing two pots when it said one is extra, not a problem. An
    # Actualise item is sorted once somebody is on it.
    def sorted?
      need_kind? ? covered.positive? : actualised?
    end

    private

    def need_is_a_need
      return if need_id.nil?

      errors.add(:need_id, :invalid) unless offer_kind? && need&.need_kind? && need.root_id == root_id
    end

    def no_new_ideas
      errors.add(:kind, :inclusion) if idea_kind?
    end

    # Checked when the asset is set, not when the item changes hands: an
    # offer handed over keeps saying what it brings.
    def asset_is_owners
      return if asset_id.nil? || !will_save_change_to_asset_id?

      errors.add(:asset_id, :invalid) unless asset&.account_id == owner_id
    end
  end
end
