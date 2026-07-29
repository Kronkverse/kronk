# frozen_string_literal: true

# Full Moment shape. Used by /api/v1/moments (create/show/index) and
# by the composer / grid views. The feed-card version is
# REST::MomentSummarySerializer.
class REST::MomentSerializer < ActiveModel::Serializer
  attributes :id, :caption, :visibility, :expires_at, :active,
             :froth_count, :frothed_by_viewer, :created_at

  belongs_to :account, serializer: REST::AccountSerializer
  belongs_to :media_attachment, serializer: REST::MediaAttachmentSerializer
  belongs_to :group, serializer: REST::GroupSerializer

  def id
    object.id.to_s
  end

  def expires_at
    object.expires_at.iso8601
  end

  def created_at
    object.created_at.iso8601
  end

  def active
    object.active?
  end

  def frothed_by_viewer
    return false unless scope

    object.frothed_by?(scope)
  end
end
