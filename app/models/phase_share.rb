# frozen_string_literal: true

# PhaseShare — directional allowlist grant. Sharer permits Viewer to
# see their derived phase. Not symmetric: adding someone to your
# allowlist does NOT add you to theirs. Revocation = destroy the row;
# no soft-delete, no retained history (KRONK_TIDES §Consent invariants).
class PhaseShare < ApplicationRecord
  belongs_to :sharer, class_name: 'Account'
  belongs_to :viewer, class_name: 'Account'

  validates :viewer_id, uniqueness: { scope: :sharer_id }
  validate  :sharer_and_viewer_differ

  scope :outbound_from, ->(account) { where(sharer_id: account.id) }
  scope :inbound_to,    ->(account) { where(viewer_id: account.id) }

  # Populate the `viewer` side of the grant. Sharer is the current
  # account. Enforced idempotent via `find_or_create_by!`.
  def self.grant!(sharer:, viewer:)
    return if sharer.id == viewer.id

    find_or_create_by!(sharer: sharer, viewer: viewer)
  end

  private

  def sharer_and_viewer_differ
    errors.add(:viewer_id, 'must differ from sharer') if sharer_id.present? && viewer_id.present? && sharer_id == viewer_id
  end
end
