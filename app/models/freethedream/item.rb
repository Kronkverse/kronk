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
# can be against a need, and can come from its owner's Mycelium (sharing
# something into an emergence is offering it there).
module Freethedream
  class Item < ApplicationRecord
    include Kronk::NamedLink

    self.table_name = 'freethedream_items'

    TITLE_MAX = 160
    BODY_MAX = 5000
    QUANTITY_MAX = 10_000_000
    UNIT_MAX = 20

    CATEGORIES = { skills: 0, things: 1, space: 2, time: 3, money: 4, connections: 5 }.freeze

    belongs_to :root, class_name: 'Freethedream::Project'
    belongs_to :owner, class_name: 'Account', optional: true
    belongs_to :need, class_name: 'Freethedream::Item', optional: true
    belongs_to :mycelium_item, class_name: 'Freethedream::MyceliumItem', optional: true
    belongs_to :source_idea, class_name: 'Freethedream::Item', optional: true
    # A Decide's quick Kuestion, asked in its Komponent.
    belongs_to :question, optional: true

    has_many :placements, class_name: 'Freethedream::Placement', dependent: :delete_all
    has_many :projects, through: :placements
    has_many :claims, class_name: 'Freethedream::Claim', dependent: :delete_all
    has_many :offers, class_name: 'Freethedream::Item', foreign_key: :need_id, inverse_of: :need, dependent: nil
    has_many :comments, class_name: 'Freethedream::Comment', as: :subject, dependent: :delete_all

    enum :kind, { idea: 0, need: 1, job: 2, offer: 3 }, suffix: :kind, validate: true
    enum :category, CATEGORIES, prefix: :category, validate: { allow_nil: true }
    # What kind of To do a job is on a Komponent's checklist: to do, pay
    # (with its amount in dollars as quantity and unit '$') or book
    # (docs/spaces/freethedream.md, The checklist), or decide, settled by a
    # quick Kuestion (`question`). Only a job has one.
    attribute :task, :integer, default: 0
    enum :task, { todo: 0, pay: 1, book: 2, decide: 3 }, prefix: :task, validate: true

    validates :title, presence: true, length: { maximum: TITLE_MAX }
    validates :body, length: { maximum: BODY_MAX }
    validates :unit, length: { maximum: UNIT_MAX }
    validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: QUANTITY_MAX }
    validate :need_is_a_need
    validate :task_is_a_jobs
    validate :question_is_a_decides
    validates :question, presence: true, on: :create, if: :task_decide?
    validate :no_new_ideas, on: :create
    validate :mycelium_item_is_owners

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

    # A To do on a Komponent's checklist is ticked off.
    def done?
      done_at.present?
    end

    # Something to bring is sorted once as many as it asks for are coming.
    # The amount is a floor, "20+" (Tal, 2026-10-18: more is better): one
    # pot is sorted by one tap, twenty plates by twenty, and anything over
    # is extra and welcome. A To do (a job) is sorted once it's ticked off
    # (Tal, 2026-11-10, the checklist), not when someone is on it.
    def sorted?
      need_kind? ? covered >= quantity : done?
    end

    private

    def need_is_a_need
      return if need_id.nil?

      errors.add(:need_id, :invalid) unless offer_kind? && need&.need_kind? && need.root_id == root_id
    end

    def task_is_a_jobs
      errors.add(:task, :inclusion) unless job_kind? || task_todo?
    end

    def question_is_a_decides
      errors.add(:question, :invalid) if question_id.present? && !task_decide?
    end

    def no_new_ideas
      errors.add(:kind, :inclusion) if idea_kind?
    end

    # Checked when the link is set, not when the item changes hands: an
    # offer handed over keeps saying what it brings.
    def mycelium_item_is_owners
      return if mycelium_item_id.nil? || !will_save_change_to_mycelium_item_id?

      errors.add(:mycelium_item_id, :invalid) unless offer_kind? && mycelium_item&.account_id == owner_id
    end
  end
end
