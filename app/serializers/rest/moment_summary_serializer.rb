# frozen_string_literal: true

# Trimmed Moment shape for timeline embedding on the shared Status
# (feed projection, moments_card). Same pattern as
# REST::TrekSummarySerializer / REST::WachuneedListingSummarySerializer.
# The full detail lives at /api/v1/moments/:id.
class REST::MomentSummarySerializer < ActiveModel::Serializer
  attributes :id, :caption, :expires_at, :active, :froth_count

  belongs_to :media_attachment, serializer: REST::MediaAttachmentSerializer

  def id
    object.id.to_s
  end

  def expires_at
    object.expires_at.iso8601
  end

  def active
    object.active?
  end
end
