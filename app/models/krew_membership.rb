# frozen_string_literal: true

# One row per (krew, account) pair. Kept flat in Phase 3a: the `role`
# column stays (backward compat) but new joins default to
# role='member'. `source` records how the member arrived — direct
# UI join, invite-link redemption, or auto-join from a Kalendar RSVP
# (in which case `rsvp_event_id` is set so the member can opt out of
# the auto-join without dropping the RSVP, per brief §3).
class KrewMembership < ApplicationRecord
  ROLES = %w(seeder member).freeze
  SOURCES = %w(direct invite rsvp_auto).freeze

  belongs_to :krew, counter_cache: :member_count
  belongs_to :account
  belongs_to :rsvp_event, class_name: 'Event', optional: true

  validates :role, inclusion: { in: ROLES }
  validates :source, inclusion: { in: SOURCES }
  validates :account_id, uniqueness: { scope: :krew_id }
  validate  :rsvp_event_matches_source

  before_validation :ensure_joined_at
  after_commit :publish_krews_member_joined, on: :create
  after_commit :publish_krews_member_left,   on: :destroy

  private

  def ensure_joined_at
    self.joined_at ||= Time.current
  end

  # rsvp_event_id is only meaningful when source is 'rsvp_auto'.
  def rsvp_event_matches_source
    if source == 'rsvp_auto'
      errors.add(:rsvp_event_id, 'must be set for rsvp_auto membership') if rsvp_event_id.blank?
    elsif rsvp_event_id.present?
      errors.add(:rsvp_event_id, 'may only be set when source is rsvp_auto')
    end
  end

  # krews.member.joined — a Kronker joined a krew; Nudges routes to
  # the Krew conversation for the krew (creates it if needed), adds
  # the joining account to the memberships, and drops a `joined`
  # event onto the stream.
  def publish_krews_member_joined
    Kronk::KornerEvents.publish(
      'krews.member.joined',
      actor_account_id: account_id,
      krew_id: krew_id
    )
  end

  # krews.member.left — the inverse. Fires whether the account left
  # via the krew's own leave endpoint or via the Nudges Krew leave
  # (which destroys the KrewMembership in the same transaction). The
  # Nudges subscriber cleans up ConversationMembership idempotently.
  def publish_krews_member_left
    Kronk::KornerEvents.publish(
      'krews.member.left',
      actor_account_id: account_id,
      krew_id: krew_id
    )
  end
end
