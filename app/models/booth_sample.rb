# frozen_string_literal: true

# A sample in the Booth (docs/spaces/booth.md, Samples): a short loop, vocal,
# beat, one-shot or stem a musician shares for others to make things with.
# Up to two minutes. Its terms say how it may be used: free, as long as the
# maker is credited, or ask first, when the maker answers each request
# (`BoothSampleRequest`). Sets that use it list it under Samples used
# (`BoothSetSample`), which credits it and its maker.
class BoothSample < ApplicationRecord
  TYPES = %w(loop vocal beat one_shot stem).freeze
  TERMS = %w(free ask).freeze
  # Short by design: a sample is something to build with, not a track.
  DURATION_MAX = 120
  TITLE_MAX = 200
  KEY_MAX = 20
  GENRE_MAX = 50
  BPM_RANGE = (20..400)

  belongs_to :account
  belongs_to :pack, class_name: 'BoothSamplePack', foreign_key: :booth_sample_pack_id, optional: true, inverse_of: :samples
  belongs_to :audio_attachment, class_name: 'MediaAttachment'
  has_many :requests, class_name: 'BoothSampleRequest', inverse_of: :booth_sample, dependent: :delete_all
  has_many :set_samples, class_name: 'BoothSetSample', inverse_of: :booth_sample, dependent: :delete_all
  has_many :booth_sets, through: :set_samples

  validates :title, presence: true, length: { maximum: TITLE_MAX }
  validates :sample_type, inclusion: { in: TYPES }
  validates :terms, inclusion: { in: TERMS }
  validates :musical_key, length: { maximum: KEY_MAX }
  validates :genre, length: { maximum: GENRE_MAX }
  validates :bpm, numericality: { only_integer: true, in: BPM_RANGE }, allow_nil: true
  validates :vibes, length: { maximum: BoothSet::VIBES_MAX }
  validate :duration_must_fit
  validate :vibes_must_be_known
  validate :pack_must_be_own
  validate :audio_must_be_audio

  scope :recent, -> { order(created_at: :desc, id: :desc) }

  def ask_first?
    terms == 'ask'
  end

  # Whether `account` may download it and list it as used: its maker, anyone
  # when it's free with credit, and on ask-first anyone the maker said yes to.
  def usable_by?(account)
    return false if account.nil?
    return true if account.id == account_id || !ask_first?

    requests.exists?(account_id: account.id, state: 'yes')
  end

  def audio_url
    audio_attachment&.file&.url(:original)
  end

  private

  # Read from the file by media processing, or by the browser before upload.
  def duration_must_fit
    if duration_seconds.nil?
      errors.add(:duration_seconds, 'could not be read from the file')
    elsif !duration_seconds.between?(1, DURATION_MAX)
      errors.add(:duration_seconds, 'must be two minutes or less')
    end
  end

  def vibes_must_be_known
    errors.add(:vibes, :inclusion) unless (Array(vibes) - BoothSet::VIBES).empty?
  end

  def pack_must_be_own
    errors.add(:booth_sample_pack, :invalid) if pack && pack.account_id != account_id
  end

  def audio_must_be_audio
    errors.add(:audio_attachment, 'must be an audio file') if audio_attachment && !audio_attachment.audio?
  end
end
