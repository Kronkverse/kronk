# frozen_string_literal: true

# A live set: a musician playing to members in real time, on Huddle's
# Jitsi server (docs/spaces/booth.md, Live sets). It is scheduled until
# the host goes live (`started_at`) and over once they end it
# (`ended_at`). A set nobody ended counts as over STALE_AFTER after it
# started, and one that never started drops off MISSED_AFTER after its
# start time, so a closed tab can't leave a ghost "live now".
class BoothLive < ApplicationRecord
  # Who sees it in the Booth and on their home feed, and who is nudged when
  # it goes live: the reach the host picked, as for a post (Reachable;
  # decisions.md, 2026-10-26). Just me tells only people who asked.
  include Reachable

  STALE_AFTER = 12.hours
  MISSED_AFTER = 6.hours

  belongs_to :account

  enum :visibility,
       { public: 0, mates: 1, orbit: 3, self_only: 4 },
       suffix: :scope
  belongs_to :status, optional: true, inverse_of: :booth_live
  has_many :reminders, class_name: 'BoothLiveReminder', inverse_of: :booth_live, dependent: :delete_all
  # Its recording, made on the Jitsi server, for the host to publish as a set
  # (docs/spaces/booth.md, Recording a live set). Destroying deletes the file.
  has_many :call_recordings, dependent: :destroy
  # Shoutouts, reactions, requests and the host's Now playing, while it's
  # live (docs/spaces/booth.md, The crowd on screen).
  has_many :moments, class_name: 'BoothLiveMoment', inverse_of: :booth_live, dependent: :delete_all
  # The draft set made from its audio recording (Booth::LiveRecordingSetWorker).
  belongs_to :booth_set, optional: true

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

  # Reachable's adapter. A live set has no Krew axis.
  def self.reachable_owner_column
    :account_id
  end

  def self.reachable_krew_scope(_krew_ids)
    none
  end

  def reachable_owner_id
    account_id
  end

  def reachable_owner
    account
  end

  def reachable_krew_member?(_viewer)
    false
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

  # What the host marked as Now playing, in order, as a set's track list
  # (BoothSet#tracklist): `start_seconds` is how far into the set it came.
  def tracklist
    moments.tracks.limit(BoothSet::TRACKLIST_MAX).map(&:to_track)
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
