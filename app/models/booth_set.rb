# frozen_string_literal: true

class BoothSet < ApplicationRecord
  belongs_to :account
  belongs_to :event, optional: true
  belongs_to :audio_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :cover_attachment, class_name: 'MediaAttachment', optional: true
    belongs_to :shared_status, class_name: 'Status', optional: true, inverse_of: :booth_set

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
