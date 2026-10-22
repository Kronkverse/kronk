# frozen_string_literal: true

# A burst of photos added to an album, on its feed post: which album, how
# many photos, and a few of them to show (REST::StatusSerializer).
class REST::AlbumPhotoBatchSerializer < ActiveModel::Serializer
  PREVIEWS = 4

  attributes :id, :photos_count, :previews, :album

  def id
    object.id.to_s
  end

  def photos_count
    object.shown_photos.count
  end

  def previews
    object.shown_photos.limit(PREVIEWS).preload(status: :media_attachments).filter_map do |photo|
      url = photo.thumb_url
      { id: photo.id.to_s, url: url } if url
    end
  end

  def album
    { id: object.album_id.to_s, slug: object.album.slug, title: object.album.title }
  end
end
