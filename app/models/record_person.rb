# frozen_string_literal: true

# A person added to, or kept from, a record's audience, for the korners
# that take people on top of their reach tier and Krews
# (Kronk::PeopleAudience). `korner_slug` + `record_id` name the record as
# RecordKrew does. `excluded` false lets them see it whatever its tier;
# true keeps them out, and beats every other way in (docs/spaces/feed.md,
# Per-post audience).
class RecordPerson < ApplicationRecord
  belongs_to :account

  validates :korner_slug, :record_id, presence: true
  validates :account_id, uniqueness: { scope: %i(korner_slug record_id) }

  scope :added, -> { where(excluded: false) }
  scope :removed, -> { where(excluded: true) }
end
