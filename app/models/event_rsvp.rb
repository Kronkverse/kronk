# frozen_string_literal: true

class EventRsvp < ApplicationRecord
  belongs_to :event, counter_cache: false
  belongs_to :account

  enum :status, { going: 0, interested: 1, not_going: 2 }, prefix: true

  validates :account_id, uniqueness: { scope: :event_id }

  after_commit :update_event_counts

  private

  def update_event_counts
    event.update_columns(
      going_count: event.rsvps.status_going.count,
      interested_count: event.rsvps.status_interested.count
    )
  end
end
