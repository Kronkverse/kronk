# frozen_string_literal: true

# Cinema — a single short film by one author. Video rides the standard
# `MediaAttachment` (uploaded via `POST /api/v1/media`, referenced here
# by id). Its audience is the reach ladder plus any Krews it is for
# (`record_krews`, Kronk::KrewAudience).
class Film < ApplicationRecord
  include Reachable
  include Kronk::OwnUploads
  include Kronk::AttachmentSource
  include Kronk::AudienceBearer
  include Kronk::KrewAudience

  self.attachment_source_slug = 'cinema'

  belongs_to :owner, class_name: 'Account'
  belongs_to :video_media_attachment, class_name: 'MediaAttachment', optional: true

  owns_uploads :video_media_attachment, owner: :owner_id
  belongs_to :status, optional: true, inverse_of: :film

  enum :visibility,
       { public: 0, mates: 1, orbit: 3, self_only: 4 },
       suffix: :scope

  validates :title, presence: true, length: { maximum: 240 }
  validates :description, length: { maximum: 4000 }, allow_blank: true

  scope :recent, -> { order(created_at: :desc) }

  # The URL clients render / play. Prefers the local file URL, falls
  # back to the remote URL for federated / externally-hosted media. Nil
  # when the attachment has been vacuumed away, in which case the
  # reader renders a placeholder.
  def video_url
    return video_media_attachment.file.url(:original) if video_media_attachment&.file.present?
    return video_media_attachment.remote_url if video_media_attachment && video_media_attachment.remote_url.present?

    nil
  end

  # Reachable adapter.
  def self.reachable_owner_column
    :owner_id
  end

  def self.reachable_krew_scope(krew_ids)
    audience_krew_scope(krew_ids)
  end

  private

  def reachable_owner_id
    owner_id
  end

  def reachable_owner
    owner
  end

  def reachable_krew_member?(viewer)
    audience_krew_member?(viewer)
  end
end
