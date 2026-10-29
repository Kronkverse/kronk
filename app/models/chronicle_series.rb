# frozen_string_literal: true

# == Schema Information
#
# Table name: chronicle_series
#
#  id                        :bigint(8)        not null, primary key
#  description               :text             default(""), not null
#  title                     :string(240)      not null
#  created_at                :datetime         not null
#  updated_at                :datetime         not null
#  cover_media_attachment_id :bigint(8)
#  owner_id                  :bigint(8)        not null
#

# A Series: one writer's Kronikles, gathered as ordered chapters under a
# title (docs/spaces/kronikles.md, Series). It has no audience of its own.
# Each chapter keeps its own reach and Krews, and a Series is seen only as
# far as its chapters are: a reader sees the chapters they can see, counts
# only those, and a Series with none they can see isn't there for them.
# Its owner always sees it, chapters or not, so they can fill it.
class ChronicleSeries < ApplicationRecord
  include Kronk::OwnUploads

  self.table_name = 'chronicle_series'

  MAX_DESCRIPTION = 2_000

  belongs_to :owner, class_name: 'Account'
  belongs_to :cover_media_attachment, class_name: 'MediaAttachment', optional: true

  owns_uploads :cover_media_attachment, owner: :owner_id

  # Deleting a Series keeps its Kronikles: `unlink_chapters` lets them go
  # first (the key's ON DELETE SET NULL is the backstop).
  has_many :chapters, -> { order(:series_position, :id) },
           class_name: 'Chronicle', foreign_key: :series_id, inverse_of: :series, dependent: nil

  validates :title, presence: true, length: { maximum: 240 }
  validates :description, length: { maximum: MAX_DESCRIPTION }

  before_destroy :unlink_chapters

  # Series `viewer` (nil = signed out) can see: their own, and any with a
  # chapter they can see. As id subqueries, not `merge` (Kronk::KornerRecords).
  def self.visible_to(viewer)
    seen = where(id: Chronicle.visible_to(viewer).where.not(series_id: nil).select(:series_id))
    viewer ? seen.or(where(owner_id: viewer.id)) : seen
  end

  def visible_to?(viewer)
    return true if viewer && viewer.id == owner_id

    chapters_visible_to(viewer).exists?
  end

  # The chapters `viewer` can see, in reading order.
  def chapters_visible_to(viewer)
    chapters.where(id: Chronicle.visible_to(viewer).select(:id))
  end

  # Put the chapters in the order of `ids`. It must name every chapter
  # once, and nothing else; otherwise nothing changes and it says false.
  def reorder_chapters!(ids)
    return false unless ids.is_a?(Array)

    wanted = ids.map { |chronicle_id| chronicle_id.to_s.to_i }
    return false unless wanted.uniq.size == wanted.size && wanted.sort == chapters.pluck(:id).sort

    transaction do
      wanted.each_with_index do |chronicle_id, index|
        Chronicle.where(id: chronicle_id, series_id: id).update_all(series_position: index + 1)
      end
    end
    true
  end

  private

  def unlink_chapters
    Chronicle.where(series_id: id).update_all(series_id: nil, series_position: nil)
  end
end
