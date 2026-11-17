# frozen_string_literal: true

# Samples grouped under one title and cover, the way an album groups tracks
# (docs/spaces/booth.md, Samples). Each sample keeps its own details and
# terms. Deleting the pack deletes its samples.
class BoothSamplePack < ApplicationRecord
  TITLE_MAX = 200
  SAMPLES_MAX = 30

  belongs_to :account
  belongs_to :cover_attachment, class_name: 'MediaAttachment', optional: true
  has_many :samples, -> { order(:position, :id) }, class_name: 'BoothSample', inverse_of: :pack, dependent: :destroy

  validates :title, presence: true, length: { maximum: TITLE_MAX }
  validates :description, length: { maximum: 5000 }

  scope :recent, -> { order(created_at: :desc, id: :desc) }

  def cover_url
    cover_attachment&.file&.url(:small)
  end
end
