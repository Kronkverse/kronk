# frozen_string_literal: true

class EventRsvp < ApplicationRecord
  belongs_to :event, counter_cache: false
  belongs_to :account

  enum :status, { going: 0, interested: 1, not_going: 2 }, prefix: true

  validates :account_id, uniqueness: { scope: :event_id }

  after_commit :update_event_counts
  after_commit :publish_kalendar_event_rsvpd, on: :create

  private

  # Not when the event itself is being deleted: the counts have nowhere to
  # go, and update_columns on a destroyed record raised (deleting an event
  # with RSVPs answered 500).
  def update_event_counts
    return if destroyed_by_association || event.nil? || event.destroyed?

    event.update_columns(
      going_count: event.rsvps.status_going.count,
      interested_count: event.rsvps.status_interested.count
    )
  end

  # kalendar.event.rsvpd — someone RSVPed to an event; Nudges routes
  # to the event creator's Mate chat with the RSVPer (if Mates).
  def publish_kalendar_event_rsvpd
    Kronk::KornerEvents.publish(
      'kalendar.event.rsvpd',
      actor_account_id: account_id,
      recipient_account_id: event.account_id,
      event_id: event_id,
      status: status
    )
  end
end
