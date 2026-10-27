# frozen_string_literal: true

# A Kronikles Series, as /api/v1/kronikles/series returns it. Its chapter
# count is the chapters the viewer can see, never the whole Series.
class REST::ChronicleSeriesSerializer < ActiveModel::Serializer
  include RoutingHelper

  attributes :id, :title, :description, :cover_url, :chapter_count, :is_owner, :created_at, :updated_at

  # The cover's upload id, for the owner's edit form only.
  attribute :cover_id, if: :owner?

  belongs_to :owner, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end

  def cover_url
    url = object.cover_media_attachment&.file&.url(:small)
    url.present? ? full_asset_url(url) : nil
  end

  def cover_id
    object.cover_media_attachment_id&.to_s
  end

  def chapter_count
    object.chapters_visible_to(viewer).count
  end

  def is_owner # rubocop:disable Naming/PredicatePrefix
    owner?
  end

  def created_at
    object.created_at.iso8601
  end

  def updated_at
    object.updated_at.iso8601
  end

  def owner?
    viewer.present? && object.owner_id == viewer.id
  end

  private

  def viewer
    current_user&.account
  end
end
