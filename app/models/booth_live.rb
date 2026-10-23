# frozen_string_literal: true

# A live set: a musician playing to members in real time, on Huddle's
# Jitsi server (docs/spaces/booth.md, Live sets). It is scheduled until
# the host goes live (`started_at`) and over once they end it
# (`ended_at`). A set nobody ended counts as over STALE_AFTER after it
# started, and one that never started drops off MISSED_AFTER after its
# start time, so a closed tab can't leave a ghost "live now".
class BoothLive < ApplicationRecord
  STALE_AFTER = 12.hours
  MISSED_AFTER = 6.hours

  belongs_to :account
  belongs_to :status, optional: true
  has_many :reminders, class_name: 'BoothLiveReminder', inverse_of: :booth_live, dependent: :delete_all

  validates :title, presence: true, length: { maximum: 200 }
  validates :description, length: { maximum: 2000 }
  validates :genres, length: { maximum: 10 }
  validates :room_key, presence: true, uniqueness: true
  validates :starts_at, presence: true

  before_validation :assign_room_key, on: :create

  scope :not_ended, -> { where(ended_at: nil) }
  scope :live, -> { not_ended.where(started_at: STALE_AFTER.ago..) }
  scope :upcoming, -> { not_ended.where(started_at: nil, starts_at: MISSED_AFTER.ago..) }

  # What the Booth lists: live now first, then what's coming, soonest first.
  def self.listing
    live.order(started_at: :desc).to_a + upcoming.order(:starts_at).to_a
  end

  def state
    if ended_at.present? || (started_at.present? && started_at < STALE_AFTER.ago)
      'ended'
    elsif started_at.present?
      'live'
    else
      'scheduled'
    end
  end

  def live?
    state == 'live'
  end

  def ended?
    state == 'ended'
  end

  # Going live tells everyone tuned in to the Booth, and anyone who asked
  # to be reminded (Booth::LiveNotifier), once; ending takes those nudges
  # back.
  def start!
    return if started_at.present?

    update!(started_at: Time.current)
    Booth::LiveNotifyWorker.perform_async(id)
  end

  def finish!
    return if ended_at.present?

    update!(ended_at: Time.current)
    Booth::LiveNotifier.new(self).withdraw
  end

  private

  # The Jitsi room name. Unguessable, so the room is reached through the
  # Booth rather than by typing a name.
  def assign_room_key
    self.room_key ||= "booth-#{SecureRandom.hex(10)}"
  end
end
