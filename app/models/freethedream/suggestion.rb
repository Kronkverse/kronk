# frozen_string_literal: true

# Someone suggested for a checklist entry (Kommons "Tagging people on a
# checklist item", 2026-11-22): a To do or something to Bring that a person
# in the projekt thinks they could help with ("I know they have a
# generator"). It's a nudge, not a job: they take it on as anyone does
# (On it, I'll bring it), which ends the suggestion, or say it's not for
# them.
module Freethedream
  class Suggestion < ApplicationRecord
    self.table_name = 'freethedream_suggestions'

    belongs_to :item, class_name: 'Freethedream::Item'
    belongs_to :account
    belongs_to :suggested_by, class_name: 'Account', optional: true

    validates :account_id, uniqueness: { scope: :item_id }
    validate :item_is_on_a_checklist, on: :create
    validate :account_is_in_the_projekt, on: :create

    private

    def item_is_on_a_checklist
      errors.add(:item_id, :invalid) unless item&.job_kind? || item&.need_kind?
    end

    def account_is_in_the_projekt
      errors.add(:account_id, :invalid) unless item && account && item.root.member?(account)
    end
  end
end
