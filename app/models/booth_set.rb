# frozen_string_literal: true

class BoothSet < ApplicationRecord
  include Searchable

  searchable_as :booth_sets

  def as_json_for_search
    {
      id: id,
      title: title.to_s,
      artist_name: artist_name.to_s,
      genre: genre.to_s,
      event_name: event_name.to_s,
      account_id: account_id,
      published: published?,
      play_count: play_count.to_i,
      created_at: created_at&.to_i,
    }
  end

  belongs_to :account
  belongs_to :event, optional: true
  belongs_to :audio_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :cover_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :booth_set

  # Transitional dual-write. `shared_status_id` is the pre-2.0.0 column;
  # `status_id` is the canonical §5.5 column. Both stay populated during
  # the transition; old column drops in 2.1.
  def shared_status_id=(value)
    super
    self[:status_id] = value if has_attribute?(:status_id)
  end

  def status_id=(value)
    super
    self[:shared_status_id] = value if has_attribute?(:shared_status_id)
  end

  # Deprecated readers — new code uses `#status(_id)`. Logs once per
  # process on first read so stray call-sites surface in staging logs
  # before the shared_status_id column drops in 2.1.0.
  def shared_status
    BoothSet.warn_deprecated_status_read!
    status
  end

  def shared_status_id
    BoothSet.warn_deprecated_status_read!
    read_attribute(:shared_status_id) || self[:status_id]
  end

  def self.warn_deprecated_status_read!
    return if @deprecated_status_read_warned

    @deprecated_status_read_warned = true
    Rails.logger.warn('[BoothSet] deprecated read of shared_status(_id); prefer #status(_id). Column drops in 2.1.0.')
  end

  validates :title, presence: true, length: { maximum: 200 }
  validates :artist_name, presence: true, length: { maximum: 200 }
  validates :description, length: { maximum: 5000 }
  validates :event_name, length: { maximum: 200 }
  validates :genres, length: { maximum: 10 }

  scope :published, -> { where(published: true) }
  scope :recent, -> { order(created_at: :desc) }

  def audio_url
    audio_attachment&.file&.url(:original)
  end

  def cover_url
    cover_attachment&.file&.url(:small)
  end

  def increment_play_count!
    increment!(:play_count)
  end
end
