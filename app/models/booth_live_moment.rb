# frozen_string_literal: true

# Something that happens in a live set besides the music
# (docs/spaces/booth.md, The crowd on screen). Listeners send shoutouts,
# reactions and track requests; the host marks what's playing (`track`).
# Each shows over the stream for everyone watching and goes into the call
# for the recorder to draw. `at_seconds` is how far into the set it came
# (from `started_at`), so the host's tracks become the set's track list.
#
# Only while the set is live, and only for people its reach allows
# (BoothLive#visible_to?, checked by Api::V1::BoothLiveMomentsController).
class BoothLiveMoment < ApplicationRecord
  KINDS = %w(shoutout reaction request track).freeze
  # The reactions a listener can send. The text in the call is the key;
  # whoever draws it picks the words or icon (booth.md has the list).
  REACTIONS = %w(froth applause rewind).freeze
  BODY_MAX = 200
  # One moment per person every few seconds, so a held-down button can't
  # bury the screen.
  THROTTLE = 2.seconds

  belongs_to :booth_live, inverse_of: :moments
  belongs_to :account

  validates :kind, inclusion: { in: KINDS }
  validates :body, length: { maximum: BODY_MAX }
  validates :body, presence: true, if: -> { %w(shoutout request).include?(kind) }
  validates :body, inclusion: { in: REACTIONS }, if: -> { kind == 'reaction' }
  validates :title, presence: true, length: { maximum: BoothSet::TRACK_FIELD_MAX }, if: -> { kind == 'track' }
  validates :artist, length: { maximum: BoothSet::TRACK_FIELD_MAX }
  validates :at_seconds, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :track_list_not_full, on: :create, if: -> { kind == 'track' }

  before_validation :set_at_seconds, on: :create

  scope :tracks, -> { where(kind: 'track').order(:at_seconds, :id) }

  # Did this person send something to this set a moment ago?
  def self.too_soon?(booth_live, account, now: Time.current)
    where(booth_live: booth_live, account: account).exists?(created_at: (now - THROTTLE)..)
  end

  # "Artist - Title" (or just "Title") into a track, the way the set's track
  # list reads a line.
  def track_text=(text)
    parsed = BoothSet.parse_track_line(text.to_s.tr("\n", ' '))
    self.artist = parsed&.dig('artist')
    self.title = parsed&.dig('title')
  end

  # What it says on screen: the words, the reaction's key, or the track.
  def text
    kind == 'track' ? [artist.presence, title].compact.join(' – ') : body
  end

  # The set's track list entry (BoothSet#tracklist).
  def to_track
    { 'start_seconds' => at_seconds.clamp(0, BoothSet::TRACK_START_MAX), 'artist' => artist.presence, 'title' => title.to_s.truncate(BoothSet::TRACK_FIELD_MAX) }
  end

  private

  def set_at_seconds
    started = booth_live&.started_at
    self.at_seconds = started ? [(Time.current - started).to_i, 0].max : 0
  end

  def track_list_not_full
    return if booth_live.nil? || booth_live.moments.where(kind: 'track').count < BoothSet::TRACKLIST_MAX

    errors.add(:base, "A set's track list holds #{BoothSet::TRACKLIST_MAX} tracks")
  end
end
